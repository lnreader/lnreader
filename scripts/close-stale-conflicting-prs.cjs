const COMMENT_MARKER = '<!-- close-stale-conflicting-prs -->';

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
          createdAt
          mergeable
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

const PR_RECHECK_QUERY = `
  query ($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        id
        state
        baseRefName
        createdAt
        mergeable
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
        comments(last: 5) {
          nodes {
            body
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

const DELETE_COMMENT_MUTATION = `
  mutation ($commentId: ID!) {
    deleteIssueComment(input: { id: $commentId }) {
      clientMutationId
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

const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 4,
  retryDelayMs: 5000,
  chunkSize: 20,
  sleep: defaultSleep,
};

function subtractMonthsUtc(date, months) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('date must be a valid Date');
  }
  if (!Number.isInteger(months) || months <= 0) {
    throw new RangeError('months must be a positive integer');
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
    // GitHub GraphQL returns null for pushedDate on fork PRs; keep as bonus signal for same-repo branches.
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
  const unit = staleMonths === 1 ? 'month' : 'months';
  return [
    `Closing this pull request because it currently has merge conflicts with \`${baseBranch}\` and has not had any code updates in over ${staleMonths} ${unit} (last modified on ${lastModifiedDate}).`,
    '',
    `If you would still like to pursue this change, please rebase on \`${baseBranch}\` to resolve the conflicts and reopen this pull request (or open a new one).`,
    '',
    COMMENT_MARKER,
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
  retryOptions = {},
  core,
}) {
  const { maxRetries, retryDelayMs, chunkSize, sleep } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...retryOptions,
  };
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

    for (let offset = 0; offset < pending.length; offset += chunkSize) {
      const chunk = pending.slice(offset, offset + chunkSize);
      const fields = chunk
        .map(
          pr =>
            `pr_${pr.number}: pullRequest(number: ${pr.number}) { mergeable }`,
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

      for (const pr of chunk) {
        const refreshed = repoData[`pr_${pr.number}`];
        if (refreshed) {
          pr.mergeable = refreshed.mergeable;
        }
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

async function fetchPrForRecheck({ github, owner, repo, number }) {
  const data = await github.graphql(PR_RECHECK_QUERY, {
    owner,
    repo,
    number,
  });
  return data?.repository?.pullRequest || null;
}

function toPrEntry(pr, lastModifiedDate, extra = {}) {
  return {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    lastModifiedDate,
    ...extra,
  };
}

function toSummaryRows(items, formatOutcome) {
  return items.map(item => [
    `[#${item.number}](${item.url})`,
    item.title,
    item.lastModifiedDate,
    formatOutcome(item),
  ]);
}

async function writeSummary({ core, results }) {
  if (!core?.summary) {
    return;
  }

  const mode = results.dryRun ? 'Dry run (no changes made)' : 'Live';
  const unit = results.staleMonths === 1 ? 'month' : 'months';
  const rows = [
    ...toSummaryRows(results.closed, () => 'Closed'),
    ...toSummaryRows(results.wouldClose, () => 'Would close (dry run)'),
    ...toSummaryRows(
      results.skippedRecheck,
      () => 'Skipped (changed before close)',
    ),
    ...toSummaryRows(results.failed, item => `Failed: ${item.error}`),
  ];

  const stats = [
    `Mode: ${mode}`,
    `Base branch: \`${results.targetBranch}\``,
    `Cutoff date: \`${results.cutoffDate.toISOString()}\``,
    `Open PRs scanned: ${results.totalOpen}`,
    `Stale PRs (> ${results.staleMonths} ${unit}): ${results.staleCount}`,
    `Stale & conflicting: ${results.conflictingCount}`,
    `Unresolved mergeability (skipped): ${results.unresolvedCount}`,
  ];

  if (results.skippedRecheck.length > 0) {
    stats.push(
      `Skipped on pre-close recheck: ${results.skippedRecheck.length}`,
    );
  }

  core.summary.addHeading('Close Stale Conflicting PRs').addList(stats);

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
  retryOptions = {},
}) {
  const cutoffDate = subtractMonthsUtc(now, staleMonths);
  const { owner, repo } = context.repo;
  const { targetBranch, pullRequests } = await fetchOpenPrs({
    github,
    owner,
    repo,
    baseBranch,
  });

  core?.info?.(
    `Scanning ${pullRequests.length} open PR(s) targeting ${targetBranch} with code cutoff < ${cutoffDate.toISOString()}`,
  );

  const recent = [];
  const stale = [];

  for (const pr of pullRequests) {
    const lastModifiedAt = getLastCodeModifiedAt(pr);
    const entry = { pr, lastModifiedAt };
    if (lastModifiedAt < cutoffDate) {
      stale.push(entry);
    } else {
      recent.push(entry);
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
      retryOptions,
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
    skippedRecheck: [],
    failed: [],
  };

  for (const { pr, lastModifiedAt } of conflicting) {
    const lastModifiedDate = lastModifiedAt.toISOString().slice(0, 10);

    if (dryRun) {
      core?.info?.(
        `[DRY RUN] Would close PR #${pr.number} (${pr.title}) — last modified ${lastModifiedDate}`,
      );
      results.wouldClose.push(toPrEntry(pr, lastModifiedDate));
      continue;
    }

    let createdCommentId = null;

    try {
      const freshPr = await fetchPrForRecheck({
        github,
        owner,
        repo,
        number: pr.number,
      });

      const freshLastModifiedAt = freshPr
        ? getLastCodeModifiedAt({ ...freshPr, number: pr.number })
        : null;

      const stillQualifies =
        Boolean(freshPr) &&
        freshPr.state === 'OPEN' &&
        freshPr.baseRefName === targetBranch &&
        freshPr.mergeable === 'CONFLICTING' &&
        freshLastModifiedAt !== null &&
        freshLastModifiedAt < cutoffDate;

      if (!stillQualifies) {
        core?.info?.(
          `Skipping PR #${pr.number} (${pr.title}): state changed during run (state=${freshPr?.state}, base=${freshPr?.baseRefName}, mergeable=${freshPr?.mergeable}).`,
        );
        results.skippedRecheck.push(toPrEntry(pr, lastModifiedDate));
        continue;
      }

      const freshLastModifiedDate = freshLastModifiedAt
        .toISOString()
        .slice(0, 10);
      const alreadyCommented = Boolean(
        freshPr.comments?.nodes?.some(node =>
          node?.body?.includes(COMMENT_MARKER),
        ),
      );

      if (!alreadyCommented) {
        const body = buildCloseComment({
          baseBranch: targetBranch,
          staleMonths,
          lastModifiedAt: freshLastModifiedAt,
        });
        const commentResult = await github.graphql(ADD_COMMENT_MUTATION, {
          subjectId: freshPr.id,
          body,
        });
        createdCommentId =
          commentResult?.addComment?.commentEdge?.node?.id || null;
      }

      try {
        await github.graphql(CLOSE_PR_MUTATION, {
          pullRequestId: freshPr.id,
        });
      } catch (closeError) {
        if (createdCommentId) {
          try {
            await github.graphql(DELETE_COMMENT_MUTATION, {
              commentId: createdCommentId,
            });
          } catch (rollbackError) {
            const rollbackMessage =
              rollbackError instanceof Error
                ? rollbackError.message
                : String(rollbackError);
            core?.warning?.(
              `Failed to roll back comment ${createdCommentId} on PR #${pr.number}: ${rollbackMessage}`,
            );
          }
        }
        throw closeError;
      }

      core?.info?.(
        `Closed PR #${pr.number} (${pr.title}) — last modified ${freshLastModifiedDate}`,
      );
      results.closed.push(toPrEntry(pr, freshLastModifiedDate));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core?.error?.(`Failed to close PR #${pr.number}: ${message}`);
      results.failed.push(toPrEntry(pr, lastModifiedDate, { error: message }));
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
  COMMENT_MARKER,
  subtractMonthsUtc,
  getLastCodeModifiedAt,
  buildCloseComment,
  fetchOpenPrs,
  resolveUnknownMergeability,
  run,
};
