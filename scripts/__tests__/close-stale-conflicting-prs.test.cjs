const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COMMENT_MARKER,
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
  state = 'OPEN',
  baseRefName = 'master',
  createdAt = '2026-01-15T00:00:00Z',
  committedDate = createdAt,
  pushedDate = null,
  forcePushedAt = null,
  updatedAt = '2026-09-15T08:08:49Z',
  mergeable = 'CONFLICTING',
  comments = [],
}) {
  return {
    id,
    number,
    title,
    url: `https://github.com/lnreader/lnreader/pull/${number}`,
    state,
    baseRefName,
    createdAt,
    updatedAt,
    mergeable,
    commits: {
      nodes: committedDate ? [{ commit: { committedDate, pushedDate } }] : [],
    },
    timelineItems: {
      nodes: forcePushedAt ? [{ createdAt: forcePushedAt }] : [],
    },
    comments: {
      nodes: comments.map(body => ({ body })),
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

test('buildCloseComment handles singular/plural, rebase wording, marker, and strict cutoff boundary', async () => {
  const singleMonthComment = buildCloseComment({
    baseBranch: 'master',
    staleMonths: 1,
    lastModifiedAt: new Date('2026-01-29T00:00:00Z'),
  });
  assert.match(singleMonthComment, /over 1 month \(/);
  assert.match(singleMonthComment, /rebase on `master`/);
  assert.ok(singleMonthComment.includes(COMMENT_MARKER));

  const sixMonthsComment = buildCloseComment({
    baseBranch: 'main',
    staleMonths: 6,
    lastModifiedAt: new Date('2026-01-29T00:00:00Z'),
  });
  assert.match(sixMonthsComment, /over 6 months \(/);

  const exactCutoffPr = makePr({
    number: 10,
    createdAt: '2026-05-26T00:00:00.000Z',
    mergeable: 'CONFLICTING',
  });
  const justBeforeCutoffPr = makePr({
    number: 11,
    createdAt: '2026-05-25T23:59:59.999Z',
    mergeable: 'CONFLICTING',
  });
  const prByNumber = new Map([
    [10, exactCutoffPr],
    [11, justBeforeCutoffPr],
  ]);

  const github = {
    async graphql(query, variables) {
      if (query.includes('defaultBranchRef')) {
        return { repository: { defaultBranchRef: { name: 'master' } } };
      }
      if (query.includes('pullRequests(')) {
        return {
          repository: {
            pullRequests: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [exactCutoffPr, justBeforeCutoffPr],
            },
          },
        };
      }
      if (query.includes('pullRequest(number:')) {
        return {
          repository: { pullRequest: prByNumber.get(variables.number) },
        };
      }
      if (query.includes('addComment')) {
        return { addComment: { commentEdge: { node: { id: 'IC_11' } } } };
      }
      if (query.includes('closePullRequest')) {
        return {
          closePullRequest: {
            pullRequest: { id: variables.pullRequestId, state: 'CLOSED' },
          },
        };
      }
      throw new Error(`Unexpected query: ${query}`);
    },
  };

  const results = await run({
    github,
    context: { repo: { owner: 'lnreader', repo: 'lnreader' } },
    core: createMockCore(),
    dryRun: false,
    staleMonths: 6,
    now: new Date('2026-11-26T00:00:00.000Z'),
  });

  assert.equal(results.recentCount, 1);
  assert.equal(results.staleCount, 1);
  assert.deepEqual(
    results.closed.map(item => item.number),
    [11],
  );
});

test('run paginates, chunks UNKNOWN retries for stale PRs only, and closes stale conflicting PRs', async () => {
  const allPrs = [
    // Stale conflicting -> should close
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
    // Stale UNKNOWN -> stays UNKNOWN after maxRetries -> skip with warning
    makePr({
      number: 1756,
      createdAt: '2026-02-21T21:41:22Z',
      committedDate: '2026-02-21T21:41:21Z',
      mergeable: 'UNKNOWN',
    }),
    // Recent PRs -> skip and never retry
    makePr({
      number: 1900,
      createdAt: '2026-06-15T00:00:00Z',
      mergeable: 'CONFLICTING',
    }),
    makePr({
      number: 1901,
      createdAt: '2026-07-01T00:00:00Z',
      mergeable: 'UNKNOWN',
    }),
  ];

  const pages = [
    {
      pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
      nodes: allPrs.slice(0, 3),
    },
    {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: allPrs.slice(3),
    },
  ];
  const byNumber = new Map(allPrs.map(pr => [pr.number, pr]));

  const retryQueries = [];
  const mutations = [];

  const github = {
    async graphql(query, variables) {
      if (query.includes('defaultBranchRef')) {
        return { repository: { defaultBranchRef: { name: 'master' } } };
      }
      if (query.includes('pullRequests(')) {
        const pageIndex = variables.cursor ? 1 : 0;
        return { repository: { pullRequests: pages[pageIndex] } };
      }
      if (query.includes('pr_')) {
        retryQueries.push(query);
        if (query.includes('pr_1740')) {
          return {
            repository: {
              pr_1732: { mergeable: 'UNKNOWN' },
              pr_1740: { mergeable: 'MERGEABLE' },
            },
          };
        }
        if (query.includes('pr_1732')) {
          return {
            repository: {
              pr_1732: { mergeable: 'CONFLICTING' },
              pr_1756: { mergeable: 'UNKNOWN' },
            },
          };
        }
        return {
          repository: {
            pr_1756: { mergeable: 'UNKNOWN' },
          },
        };
      }
      if (query.includes('pullRequest(number:')) {
        return { repository: { pullRequest: byNumber.get(variables.number) } };
      }
      if (query.includes('addComment')) {
        mutations.push({ type: 'addComment', variables });
        return {
          addComment: {
            commentEdge: { node: { id: `IC_${variables.subjectId}` } },
          },
        };
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
    retryOptions: {
      maxRetries: 2,
      retryDelayMs: 100,
      chunkSize: 2,
      sleep: async ms => {
        sleepCalls.push(ms);
      },
    },
  });

  // Round 1: 3 stale UNKNOWN PRs split into chunks of [2, 1]; Round 2: 2 PRs in 1 chunk
  assert.equal(retryQueries.length, 3);
  assert.ok(retryQueries.every(q => !q.includes('pr_1901')));
  assert.deepEqual(sleepCalls, [100, 100]);

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
  assert.ok(core.warnings.some(msg => msg.includes('#1756')));
  assert.equal(mutations.length, 4);
});

test('pre-close recheck skips PRs modified, resolved, retargeted, or closed mid-run', async () => {
  const initialPrs = [
    makePr({
      number: 201,
      createdAt: '2026-01-01T00:00:00Z',
      mergeable: 'CONFLICTING',
    }),
    makePr({
      number: 202,
      createdAt: '2026-01-01T00:00:00Z',
      mergeable: 'CONFLICTING',
    }),
    makePr({
      number: 203,
      createdAt: '2026-01-01T00:00:00Z',
      mergeable: 'CONFLICTING',
    }),
    makePr({
      number: 204,
      createdAt: '2026-01-01T00:00:00Z',
      mergeable: 'CONFLICTING',
    }),
    makePr({
      number: 205,
      createdAt: '2026-01-01T00:00:00Z',
      mergeable: 'CONFLICTING',
    }),
  ];

  const recheckedByNumber = new Map([
    [
      201,
      makePr({
        number: 201,
        createdAt: '2026-01-01T00:00:00Z',
        committedDate: '2026-11-26T00:00:00Z',
        mergeable: 'CONFLICTING',
      }),
    ],
    [
      202,
      makePr({
        number: 202,
        createdAt: '2026-01-01T00:00:00Z',
        mergeable: 'MERGEABLE',
      }),
    ],
    [
      203,
      makePr({
        number: 203,
        createdAt: '2026-01-01T00:00:00Z',
        baseRefName: 'legacy',
        mergeable: 'CONFLICTING',
      }),
    ],
    [
      204,
      makePr({
        number: 204,
        createdAt: '2026-01-01T00:00:00Z',
        state: 'CLOSED',
        mergeable: 'CONFLICTING',
      }),
    ],
    [
      205,
      makePr({
        number: 205,
        createdAt: '2026-01-01T00:00:00Z',
        mergeable: 'CONFLICTING',
      }),
    ],
  ]);

  const mutations = [];
  const github = {
    async graphql(query, variables) {
      if (query.includes('pullRequests(')) {
        return {
          repository: {
            pullRequests: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: initialPrs,
            },
          },
        };
      }
      if (query.includes('pullRequest(number:')) {
        return {
          repository: { pullRequest: recheckedByNumber.get(variables.number) },
        };
      }
      if (query.includes('addComment')) {
        mutations.push(['addComment', variables.subjectId]);
        return { addComment: { commentEdge: { node: { id: 'IC_205' } } } };
      }
      if (query.includes('closePullRequest')) {
        mutations.push(['closePullRequest', variables.pullRequestId]);
        return {};
      }
      throw new Error(`Unexpected query: ${query}`);
    },
  };

  const results = await run({
    github,
    context: { repo: { owner: 'lnreader', repo: 'lnreader' } },
    core: createMockCore(),
    dryRun: false,
    baseBranch: 'master',
    staleMonths: 6,
    now: new Date('2026-11-26T00:00:00Z'),
  });

  assert.deepEqual(
    results.skippedRecheck.map(item => item.number),
    [201, 202, 203, 204],
  );
  assert.deepEqual(
    results.closed.map(item => item.number),
    [205],
  );
  assert.deepEqual(mutations, [
    ['addComment', 'PR_205'],
    ['closePullRequest', 'PR_205'],
  ]);
});

test('rolls back newly created comment on close failure, deduplicates marked comments, and supports dryRun', async () => {
  const prs = [
    makePr({
      number: 301,
      createdAt: '2026-01-01T00:00:00Z',
      mergeable: 'CONFLICTING',
    }),
    makePr({
      number: 302,
      createdAt: '2026-02-01T00:00:00Z',
      mergeable: 'CONFLICTING',
      comments: [`Existing notice\n\n${COMMENT_MARKER}`],
    }),
  ];
  const byNumber = new Map(prs.map(pr => [pr.number, pr]));

  const dryCore = createMockCore();
  const dryResults = await run({
    github: {
      async graphql(query) {
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
        throw new Error(`No recheck or mutations allowed in dryRun: ${query}`);
      },
    },
    context: { repo: { owner: 'lnreader', repo: 'lnreader' } },
    core: dryCore,
    dryRun: true,
    baseBranch: 'main',
    staleMonths: 6,
    now: new Date('2026-11-26T00:00:00Z'),
  });

  assert.deepEqual(
    dryResults.wouldClose.map(item => item.number),
    [301, 302],
  );
  const tableCall = dryCore.summaryCalls.find(([name]) => name === 'addTable');
  assert.equal(
    tableCall[1][1][0],
    '[#301](https://github.com/lnreader/lnreader/pull/301)',
  );

  const mutationLog = [];
  const failCore = createMockCore();
  const failResults = await run({
    github: {
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
        if (query.includes('pullRequest(number:')) {
          return {
            repository: { pullRequest: byNumber.get(variables.number) },
          };
        }
        if (query.includes('addComment')) {
          mutationLog.push(['addComment', variables.subjectId]);
          return { addComment: { commentEdge: { node: { id: 'IC_301' } } } };
        }
        if (query.includes('closePullRequest')) {
          mutationLog.push(['closePullRequest', variables.pullRequestId]);
          if (variables.pullRequestId === 'PR_301') {
            throw new Error('transient close failure');
          }
          return {};
        }
        if (query.includes('deleteIssueComment')) {
          mutationLog.push(['deleteIssueComment', variables.commentId]);
          return {};
        }
        throw new Error(`Unexpected query: ${query}`);
      },
    },
    context: { repo: { owner: 'lnreader', repo: 'lnreader' } },
    core: failCore,
    dryRun: false,
    baseBranch: 'master',
    staleMonths: 6,
    now: new Date('2026-11-26T00:00:00Z'),
  });

  assert.equal(failResults.failed.length, 1);
  assert.equal(failResults.failed[0].number, 301);
  assert.deepEqual(
    failResults.closed.map(item => item.number),
    [302],
  );
  assert.deepEqual(mutationLog, [
    ['addComment', 'PR_301'],
    ['closePullRequest', 'PR_301'],
    ['deleteIssueComment', 'IC_301'],
    ['closePullRequest', 'PR_302'],
  ]);
  assert.equal(failCore.errors.length, 1);
  assert.equal(failCore.failed.length, 1);
});
