const test = require('node:test');
const assert = require('node:assert/strict');

const {
  subtractMonthsUtc,
  getLastCodeModifiedAt,
  buildCloseComment,
  run,
} = require('../close-stale-conflicting-prs.cjs');

function createMockCore() {
  const infos = [];
  const warnings = [];
  const errors = [];
  const failed = [];
  const summaryCalls = [];

  const summary = {
    addHeading(text) {
      summaryCalls.push(['addHeading', text]);
      return summary;
    },
    addList(items) {
      summaryCalls.push(['addList', items]);
      return summary;
    },
    addTable(rows) {
      summaryCalls.push(['addTable', rows]);
      return summary;
    },
    async write() {
      summaryCalls.push(['write']);
    },
  };

  return {
    infos,
    warnings,
    errors,
    failed,
    summaryCalls,
    info: msg => infos.push(msg),
    warning: msg => warnings.push(msg),
    error: msg => errors.push(msg),
    setFailed: msg => failed.push(msg),
    summary,
  };
}

function makePr({
  number,
  id = `PR_${number}`,
  title = `PR #${number}`,
  baseRefName = 'master',
  createdAt = '2026-01-15T00:00:00Z',
  committedDate = createdAt,
  pushedDate = null,
  forcePushedAt = null,
  updatedAt = '2026-09-15T08:08:49Z',
  mergeable = 'CONFLICTING',
  mergeStateStatus = 'DIRTY',
}) {
  return {
    id,
    number,
    title,
    url: `https://github.com/lnreader/lnreader/pull/${number}`,
    baseRefName,
    createdAt,
    updatedAt,
    mergeable,
    mergeStateStatus,
    commits: {
      nodes: committedDate ? [{ commit: { committedDate, pushedDate } }] : [],
    },
    timelineItems: {
      nodes: forcePushedAt ? [{ createdAt: forcePushedAt }] : [],
    },
  };
}

test('subtractMonthsUtc handles normal subtraction, cross-year wrap, and month-end clamping', () => {
  assert.equal(
    subtractMonthsUtc(new Date('2026-11-26T12:34:56.000Z'), 6).toISOString(),
    '2026-05-26T12:34:56.000Z',
  );
  assert.equal(
    subtractMonthsUtc(new Date('2026-02-15T00:00:00.000Z'), 6).toISOString(),
    '2025-08-15T00:00:00.000Z',
  );
  assert.equal(
    subtractMonthsUtc(new Date('2026-08-31T00:00:00.000Z'), 6).toISOString(),
    '2026-02-28T00:00:00.000Z',
  );
  assert.equal(
    subtractMonthsUtc(new Date('2024-08-31T00:00:00.000Z'), 6).toISOString(),
    '2024-02-29T00:00:00.000Z',
  );

  assert.throws(() => subtractMonthsUtc(new Date('2026-11-26T00:00:00Z'), 0), {
    name: 'RangeError',
  });
  assert.throws(() => subtractMonthsUtc(new Date('2026-11-26T00:00:00Z'), -3), {
    name: 'RangeError',
  });
  assert.throws(
    () => subtractMonthsUtc(new Date('2026-11-26T00:00:00Z'), 1.5),
    { name: 'RangeError' },
  );
});

test('getLastCodeModifiedAt picks max code timestamp and ignores updatedAt', () => {
  const bulkUpdatedPr = makePr({
    number: 1729,
    createdAt: '2026-01-29T03:12:21Z',
    committedDate: '2026-01-29T03:11:59Z',
    pushedDate: null,
    updatedAt: '2026-09-15T08:08:50Z',
  });
  assert.equal(
    getLastCodeModifiedAt(bulkUpdatedPr).toISOString(),
    '2026-01-29T03:12:21.000Z',
  );

  const forcePushedPr = makePr({
    number: 1800,
    createdAt: '2026-01-10T00:00:00Z',
    committedDate: '2026-01-09T00:00:00Z',
    pushedDate: null,
    forcePushedAt: '2026-07-01T10:00:00Z',
  });
  assert.equal(
    getLastCodeModifiedAt(forcePushedPr).toISOString(),
    '2026-07-01T10:00:00.000Z',
  );

  const pushedPr = makePr({
    number: 1801,
    createdAt: '2026-01-10T00:00:00Z',
    committedDate: '2026-01-10T00:00:00Z',
    pushedDate: '2026-08-05T15:30:00Z',
  });
  assert.equal(
    getLastCodeModifiedAt(pushedPr).toISOString(),
    '2026-08-05T15:30:00.000Z',
  );

  const freshlyOpenedOldCommitPr = makePr({
    number: 2200,
    createdAt: '2026-11-01T09:00:00Z',
    committedDate: '2025-12-01T00:00:00Z',
    pushedDate: null,
  });
  assert.equal(
    getLastCodeModifiedAt(freshlyOpenedOldCommitPr).toISOString(),
    '2026-11-01T09:00:00.000Z',
  );
});

test('run resolves defaultBranchRef, paginates, retries only stale UNKNOWN PRs, and closes stale conflicting PRs', async () => {
  const pages = [
    {
      pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
      nodes: [
        // Stale conflicting (even with recent updatedAt) -> should close
        makePr({
          number: 1729,
          createdAt: '2026-01-29T03:12:21Z',
          committedDate: '2026-01-29T03:11:59Z',
          updatedAt: '2026-09-15T08:08:50Z',
          mergeable: 'CONFLICTING',
        }),
        // Stale UNKNOWN -> resolves to CONFLICTING on retry 2 -> should close
        makePr({
          number: 1732,
          createdAt: '2026-01-31T12:12:25Z',
          committedDate: '2026-02-25T13:53:18Z',
          mergeable: 'UNKNOWN',
        }),
        // Stale UNKNOWN -> resolves to MERGEABLE on retry 1 -> skip
        makePr({
          number: 1740,
          createdAt: '2026-02-10T00:00:00Z',
          committedDate: '2026-02-10T00:00:00Z',
          mergeable: 'UNKNOWN',
        }),
      ],
    },
    {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [
        // Stale UNKNOWN -> stays UNKNOWN after maxRetries -> skip with warning
        makePr({
          number: 1756,
          createdAt: '2026-02-21T21:41:22Z',
          committedDate: '2026-02-21T21:41:21Z',
          mergeable: 'UNKNOWN',
        }),
        // Recent conflicting (< 6 months) -> skip (and must NOT be retried even if UNKNOWN)
        makePr({
          number: 1900,
          createdAt: '2026-06-15T00:00:00Z',
          committedDate: '2026-06-15T00:00:00Z',
          mergeable: 'CONFLICTING',
        }),
        makePr({
          number: 1901,
          createdAt: '2026-07-01T00:00:00Z',
          committedDate: '2026-07-01T00:00:00Z',
          mergeable: 'UNKNOWN',
        }),
      ],
    },
  ];

  let retryQueryCount = 0;
  const queriedBaseBranches = [];
  const mutations = [];
  const retryQueries = [];

  const github = {
    async graphql(query, variables) {
      if (query.includes('defaultBranchRef')) {
        return { repository: { defaultBranchRef: { name: 'master' } } };
      }
      if (query.includes('pullRequests(')) {
        queriedBaseBranches.push(variables.baseBranch);
        const pageIndex = variables.cursor ? 1 : 0;
        return { repository: { pullRequests: pages[pageIndex] } };
      }
      if (query.includes('pr_')) {
        retryQueryCount += 1;
        retryQueries.push(query);
        if (retryQueryCount === 1) {
          return {
            repository: {
              pr_1732: { mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' },
              pr_1740: { mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN' },
              pr_1756: { mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' },
            },
          };
        }
        return {
          repository: {
            pr_1732: { mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' },
            pr_1756: { mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' },
          },
        };
      }
      if (query.includes('addComment')) {
        mutations.push({ type: 'addComment', variables });
        return { addComment: { commentEdge: { node: { id: 'c1' } } } };
      }
      if (query.includes('closePullRequest')) {
        mutations.push({ type: 'closePullRequest', variables });
        return {
          closePullRequest: {
            pullRequest: { id: variables.pullRequestId, state: 'CLOSED' },
          },
        };
      }
      throw new Error(`Unexpected query: ${query}`);
    },
  };

  const core = createMockCore();
  const sleepCalls = [];

  const results = await run({
    github,
    context: { repo: { owner: 'lnreader', repo: 'lnreader' } },
    core,
    dryRun: false,
    staleMonths: 6,
    now: new Date('2026-11-26T00:00:00Z'),
    maxRetries: 2,
    retryDelayMs: 100,
    sleep: async ms => {
      sleepCalls.push(ms);
    },
  });

  assert.deepEqual(queriedBaseBranches, ['master', 'master']);
  assert.deepEqual(sleepCalls, [100, 100]);
  assert.equal(retryQueries.length, 2);
  assert.ok(!retryQueries[0].includes('pr_1901'));

  assert.equal(results.targetBranch, 'master');
  assert.equal(results.totalOpen, 6);
  assert.equal(results.recentCount, 2);
  assert.equal(results.staleCount, 4);
  assert.equal(results.conflictingCount, 2);
  assert.equal(results.mergeableCount, 1);
  assert.equal(results.unresolvedCount, 1);
  assert.deepEqual(
    results.closed.map(item => item.number),
    [1729, 1732],
  );
  assert.equal(results.failed.length, 0);
  assert.equal(core.failed.length, 0);
  assert.ok(core.warnings.some(msg => msg.includes('#1756')));

  assert.deepEqual(mutations, [
    {
      type: 'addComment',
      variables: {
        subjectId: 'PR_1729',
        body: buildCloseComment({
          baseBranch: 'master',
          staleMonths: 6,
          lastModifiedAt: new Date('2026-01-29T03:12:21Z'),
        }),
      },
    },
    {
      type: 'closePullRequest',
      variables: { pullRequestId: 'PR_1729' },
    },
    {
      type: 'addComment',
      variables: {
        subjectId: 'PR_1732',
        body: buildCloseComment({
          baseBranch: 'master',
          staleMonths: 6,
          lastModifiedAt: new Date('2026-02-25T13:53:18Z'),
        }),
      },
    },
    {
      type: 'closePullRequest',
      variables: { pullRequestId: 'PR_1732' },
    },
  ]);
});

test('run respects explicit baseBranch, dryRun mode executes zero mutations, and mutation errors do not abort remaining PRs', async () => {
  const prs = [
    makePr({
      number: 101,
      baseRefName: 'main',
      createdAt: '2026-01-01T00:00:00Z',
      mergeable: 'CONFLICTING',
    }),
    makePr({
      number: 102,
      baseRefName: 'main',
      createdAt: '2026-02-01T00:00:00Z',
      mergeable: 'CONFLICTING',
    }),
  ];

  let defaultBranchCalled = false;
  const mutationLog = [];

  const dryRunGithub = {
    async graphql(query, variables) {
      if (query.includes('defaultBranchRef')) {
        defaultBranchCalled = true;
        return { repository: { defaultBranchRef: { name: 'master' } } };
      }
      if (query.includes('pullRequests(')) {
        assert.equal(variables.baseBranch, 'main');
        return {
          repository: {
            pullRequests: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: prs,
            },
          },
        };
      }
      throw new Error(`No mutations allowed in dryRun: ${query}`);
    },
  };

  const dryCore = createMockCore();
  const dryResults = await run({
    github: dryRunGithub,
    context: { repo: { owner: 'lnreader', repo: 'lnreader' } },
    core: dryCore,
    dryRun: true,
    baseBranch: 'main',
    staleMonths: 6,
    now: new Date('2026-11-26T00:00:00Z'),
  });

  assert.equal(defaultBranchCalled, false);
  assert.deepEqual(
    dryResults.wouldClose.map(item => item.number),
    [101, 102],
  );
  assert.equal(dryResults.closed.length, 0);

  const partialFailureGithub = {
    async graphql(query, variables) {
      if (query.includes('pullRequests(')) {
        return {
          repository: {
            pullRequests: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: prs,
            },
          },
        };
      }
      if (query.includes('addComment')) {
        if (variables.subjectId === 'PR_101') {
          throw new Error('rate limit');
        }
        mutationLog.push(['addComment', variables.subjectId]);
        return {};
      }
      if (query.includes('closePullRequest')) {
        mutationLog.push(['closePullRequest', variables.pullRequestId]);
        return {};
      }
      throw new Error(`Unexpected query: ${query}`);
    },
  };

  const failCore = createMockCore();
  const failResults = await run({
    github: partialFailureGithub,
    context: { repo: { owner: 'lnreader', repo: 'lnreader' } },
    core: failCore,
    dryRun: false,
    baseBranch: 'main',
    staleMonths: 6,
    now: new Date('2026-11-26T00:00:00Z'),
  });

  assert.equal(failResults.failed.length, 1);
  assert.equal(failResults.failed[0].number, 101);
  assert.deepEqual(
    failResults.closed.map(item => item.number),
    [102],
  );
  assert.deepEqual(mutationLog, [
    ['addComment', 'PR_102'],
    ['closePullRequest', 'PR_102'],
  ]);
  assert.equal(failCore.errors.length, 1);
  assert.equal(failCore.failed.length, 1);
});
