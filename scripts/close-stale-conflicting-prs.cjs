const DEFAULT_BRANCH_QUERY = `
  query ($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      defaultBranchRef {
        name
      }
    }
  }
`;

const OPEN_PRS_QUERY = `
  query ($owner: String!, $repo: String!, $baseBranch: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequests(
        states: [OPEN]
        baseRefName: $baseBranch
        first: 50
        after: $cursor
        orderBy: { field: CREATED_AT, direction: ASC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          number
          title
          url
          baseRefName
          createdAt
          mergeable
          mergeStateStatus
          commits(last: 1) {
            nodes {
              commit {
                committedDate
                pushedDate
              }
            }
          }
          timelineItems(last: 1, itemTypes: [HEAD_REF_FORCE_PUSHED_EVENT]) {
            nodes {
              ... on HeadRefForcePushedEvent {
                createdAt
              }
            }
          }
        }
      }
    }
  }
`;

const ADD_COMMENT_MUTATION = `
  mutation ($subjectId: ID!, $body: String!) {
    addComment(input: { subjectId: $subjectId, body: $body }) {
      commentEdge {
        node {
          id
        }
      }
    }
  }
`;

const CLOSE_PR_MUTATION = `
  mutation ($pullRequestId: ID!) {
    closePullRequest(input: { pullRequestId: $pullRequestId }) {
      pullRequest {
        id
        state
      }
    }
  }
`;

const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function subtractMonthsUtc(date, months) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('date must be a valid Date');
  }
  if (!Number.isInteger(months) || months <= 0) {
    throw new RangeError('staleMonths must be a positive integer');
  }

  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() - months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(date.getUTCDate(), lastDayOfTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

function getLastCodeModifiedAt(pr) {
  const candidates = [
    pr.createdAt,
    pr.commits?.nodes?.[0]?.commit?.committedDate,
    pr.commits?.nodes?.[0]?.commit?.pushedDate,
    pr.timelineItems?.nodes?.[0]?.createdAt,
  ];

  const timestamps = candidates
    .filter(value => typeof value === 'string' && value.length > 0)
    .map(value => Date.parse(value))
    .filter(ms => !Number.isNaN(ms));

  if (timestamps.length === 0) {
    throw new Error(`PR #${pr.number} has no valid code timestamp`);
  }

  return new Date(Math.max(...timestamps));
}

function buildCloseComment({ baseBranch, staleMonths, lastModifiedAt }) {
  const lastModifiedDate = lastModifiedAt.toISOString().slice(0, 10);
  return [
    `Closing this pull request because it currently has merge conflicts with \`${baseBranch}\` and has not had any code updates in over ${staleMonths} months (last modified on ${lastModifiedDate}).`,
    '',
    `If you would still like to pursue this change, please resolve the conflicts against \`${baseBranch}\` and reopen this pull request (or open a new one).`,
  ].join('\n');
}

async function fetchOpenPrs({ github, owner, repo, baseBranch }) {
  let targetBranch = typeof baseBranch === 'string' ? baseBranch.trim() : '';

  if (!targetBranch) {
    const branchData = await github.graphql(DEFAULT_BRANCH_QUERY, {
      owner,
      repo,
    });
    targetBranch = branchData?.repository?.defaultBranchRef?.name || '';
    if (!targetBranch) {
      throw new Error(`Could not resolve default branch for ${owner}/${repo}`);
    }
  }

  const pullRequests = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await github.graphql(OPEN_PRS_QUERY, {
      owner,
      repo,
      baseBranch: targetBranch,
      cursor,
    });
    const connection = data?.repository?.pullRequests;
    if (!connection) {
      throw new Error(
        `Could not fetch pull requests for ${owner}/${repo} (base: ${targetBranch})`,
      );
    }

    pullRequests.push(...connection.nodes);
    hasNextPage = Boolean(connection.pageInfo?.hasNextPage);
    cursor = connection.pageInfo?.endCursor || null;
  }

  return { targetBranch, pullRequests };
}

async function resolveUnknownMergeability({
  github,
  owner,
  repo,
  prs,
  maxRetries = 4,
  retryDelayMs = 5000,
  sleep = defaultSleep,
  core,
}) {
  let pending = prs.filter(pr => pr.mergeable === 'UNKNOWN');

  for (
    let attempt = 1;
    attempt <= maxRetries && pending.length > 0;
    attempt++
  ) {
    core?.info?.(
      `Waiting ${retryDelayMs}ms for GitHub to compute mergeability for ${pending.length} stale PR(s) (attempt ${attempt}/${maxRetries})...`,
    );
    await sleep(retryDelayMs);

    const fields = pending
      .map(
        pr =>
          `pr_${pr.number}: pullRequest(number: ${pr.number}) { mergeable mergeStateStatus }`,
      )
      .join('\n');

    const query = `
      query ($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          ${fields}
        }
      }
    `;

    const data = await github.graphql(query, { owner, repo });
    const repoData = data?.repository || {};

    for (const pr of pending) {
      const refreshed = repoData[`pr_${pr.number}`];
      if (refreshed) {
        pr.mergeable = refreshed.mergeable;
        pr.mergeStateStatus = refreshed.mergeStateStatus;
      }
    }

    pending = pending.filter(pr => pr.mergeable === 'UNKNOWN');
  }

  for (const pr of pending) {
    core?.warning?.(
      `Skipping PR #${pr.number} (${pr.title}): mergeability remained UNKNOWN after ${maxRetries} retries.`,
    );
  }

  return prs;
}

async function writeSummary({ core, results }) {
  if (!core?.summary) {
    return;
  }

  const mode = results.dryRun ? 'Dry run (no changes made)' : 'Live';
  const rows = [
    ...results.closed.map(item => [
      `#${item.number}`,
      item.title,
      item.lastModifiedDate,
      'Closed',
    ]),
    ...results.wouldClose.map(item => [
      `#${item.number}`,
      item.title,
      item.lastModifiedDate,
      'Would close (dry run)',
    ]),
    ...results.failed.map(item => [
      `#${item.number}`,
      item.title,
      item.lastModifiedDate,
      `Failed: ${item.error}`,
    ]),
  ];

  core.summary
    .addHeading('Close Stale Conflicting PRs')
    .addList([
      `Mode: ${mode}`,
      `Base branch: \`${results.targetBranch}\``,
      `Cutoff date: \`${results.cutoffDate.toISOString()}\``,
      `Open PRs scanned: ${results.totalOpen}`,
      `Stale PRs (> ${results.staleMonths} months): ${results.staleCount}`,
      `Stale & conflicting: ${results.conflictingCount}`,
      `Unresolved mergeability (skipped): ${results.unresolvedCount}`,
    ]);

  if (rows.length > 0) {
    core.summary.addTable([
      [
        { data: 'PR', header: true },
        { data: 'Title', header: true },
        { data: 'Last Code Modification', header: true },
        { data: 'Outcome', header: true },
      ],
      ...rows,
    ]);
  }

  await core.summary.write();
}

async function run({
  github,
  context,
  core,
  dryRun = false,
  baseBranch = '',
  staleMonths = 6,
  now = new Date(),
  maxRetries = 4,
  retryDelayMs = 5000,
  sleep = defaultSleep,
}) {
  if (!Number.isInteger(staleMonths) || staleMonths <= 0) {
    throw new RangeError('staleMonths must be a positive integer');
  }

  const cutoffDate = subtractMonthsUtc(now, staleMonths);
  const { owner, repo } = context.repo;
  const { targetBranch, pullRequests } = await fetchOpenPrs({
    github,
    owner,
    repo,
    baseBranch,
  });

  core?.info?.(
    `Scanning ${pullRequests.length} open PR(s) targeting ${targetBranch} with code cutoff <= ${cutoffDate.toISOString()}`,
  );

  const recent = [];
  const stale = [];

  for (const pr of pullRequests) {
    const lastModifiedAt = getLastCodeModifiedAt(pr);
    const entry = { pr, lastModifiedAt };
    if (lastModifiedAt > cutoffDate) {
      recent.push(entry);
    } else {
      stale.push(entry);
    }
  }

  const unknownStalePrs = stale
    .filter(({ pr }) => pr.mergeable === 'UNKNOWN')
    .map(({ pr }) => pr);

  if (unknownStalePrs.length > 0) {
    await resolveUnknownMergeability({
      github,
      owner,
      repo,
      prs: unknownStalePrs,
      maxRetries,
      retryDelayMs,
      sleep,
      core,
    });
  }

  const conflicting = [];
  const mergeable = [];
  const unresolved = [];

  for (const entry of stale) {
    if (entry.pr.mergeable === 'CONFLICTING') {
      conflicting.push(entry);
    } else if (entry.pr.mergeable === 'MERGEABLE') {
      mergeable.push(entry);
    } else {
      unresolved.push(entry);
      if (entry.pr.mergeable !== 'UNKNOWN') {
        core?.warning?.(
          `Skipping PR #${entry.pr.number} (${entry.pr.title}): unexpected mergeable state "${entry.pr.mergeable}".`,
        );
      }
    }
  }

  const results = {
    dryRun,
    targetBranch,
    staleMonths,
    cutoffDate,
    totalOpen: pullRequests.length,
    recentCount: recent.length,
    staleCount: stale.length,
    conflictingCount: conflicting.length,
    mergeableCount: mergeable.length,
    unresolvedCount: unresolved.length,
    wouldClose: [],
    closed: [],
    failed: [],
  };

  for (const { pr, lastModifiedAt } of conflicting) {
    const lastModifiedDate = lastModifiedAt.toISOString().slice(0, 10);

    if (dryRun) {
      core?.info?.(
        `[DRY RUN] Would close PR #${pr.number} (${pr.title}) — last modified ${lastModifiedDate}`,
      );
      results.wouldClose.push({
        number: pr.number,
        title: pr.title,
        url: pr.url,
        lastModifiedDate,
      });
      continue;
    }

    const body = buildCloseComment({
      baseBranch: targetBranch,
      staleMonths,
      lastModifiedAt,
    });

    try {
      await github.graphql(ADD_COMMENT_MUTATION, {
        subjectId: pr.id,
        body,
      });
      await github.graphql(CLOSE_PR_MUTATION, {
        pullRequestId: pr.id,
      });
      core?.info?.(
        `Closed PR #${pr.number} (${pr.title}) — last modified ${lastModifiedDate}`,
      );
      results.closed.push({
        number: pr.number,
        title: pr.title,
        url: pr.url,
        lastModifiedDate,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core?.error?.(`Failed to close PR #${pr.number}: ${message}`);
      results.failed.push({
        number: pr.number,
        title: pr.title,
        url: pr.url,
        lastModifiedDate,
        error: message,
      });
    }
  }

  await writeSummary({ core, results });

  if (results.failed.length > 0) {
    core?.setFailed?.(
      `Failed to close ${results.failed.length} pull request(s).`,
    );
  }

  return results;
}

module.exports = {
  subtractMonthsUtc,
  getLastCodeModifiedAt,
  buildCloseComment,
  fetchOpenPrs,
  resolveUnknownMergeability,
  run,
};
