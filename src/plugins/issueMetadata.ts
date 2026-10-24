import * as cheerio from 'cheerio';
import { fetchTimeout } from '@utils/fetch/fetch';
import type { PluginIssueRepository } from './issueIndex';

const issueTitles = new Map<string, string>();
const inFlightTitles = new Map<string, Promise<string | undefined>>();

export function getPluginIssueTitleCacheKey(
  repository: PluginIssueRepository,
  issueNumber: number,
): string {
  return `${repository.owner.toLowerCase()}/${repository.name.toLowerCase()}#${issueNumber}`;
}

export function getPluginIssueUrl(
  repository: PluginIssueRepository,
  issueNumber: number,
): string {
  return `https://github.com/${repository.owner}/${repository.name}/issues/${issueNumber}`;
}

function normalizeTitle(value: string | undefined): string | undefined {
  const title = value?.replace(/\s+/g, ' ').trim();
  return title || undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseIssueTitle(
  html: string,
  repository: PluginIssueRepository,
  issueNumber: number,
): string | undefined {
  const closingHead = /<\/head\s*>/i.exec(html);
  const document = closingHead
    ? html.slice(0, closingHead.index + closingHead[0].length)
    : html;
  const $ = cheerio.load(document);
  const candidates = [
    $('meta[property="og:title"]').first().attr('content'),
    $('meta[name="twitter:title"]').first().attr('content'),
    $('title').first().text(),
  ];
  const selectedTitle = candidates
    .map(normalizeTitle)
    .find((title): title is string => title !== undefined);

  if (!selectedTitle) {
    return undefined;
  }

  const repositoryPath = `${escapeRegExp(repository.owner)}/${escapeRegExp(
    repository.name,
  )}`;
  const issueDecoration = new RegExp(
    ` · Issue #${issueNumber} · ${repositoryPath}(?: · GitHub)?$`,
    'i',
  );
  return normalizeTitle(selectedTitle.replace(issueDecoration, ''));
}

async function requestIssueTitle(
  repository: PluginIssueRepository,
  issueNumber: number,
): Promise<string | undefined> {
  try {
    const response = await fetchTimeout(
      getPluginIssueUrl(repository, issueNumber),
      { headers: { Accept: 'text/html' } },
    );
    if (!response.ok) {
      return undefined;
    }

    const title = parseIssueTitle(
      await response.text(),
      repository,
      issueNumber,
    );
    if (title) {
      issueTitles.set(
        getPluginIssueTitleCacheKey(repository, issueNumber),
        title,
      );
      return title;
    }
  } catch {
    // GitHub metadata is optional. The issue-number link remains usable.
  }

  return undefined;
}

export function getCachedPluginIssueTitle(
  repository: PluginIssueRepository,
  issueNumber: number,
): string | undefined {
  return issueTitles.get(getPluginIssueTitleCacheKey(repository, issueNumber));
}

export function loadPluginIssueTitle(
  repository: PluginIssueRepository,
  issueNumber: number,
): Promise<string | undefined> {
  const cachedTitle = getCachedPluginIssueTitle(repository, issueNumber);
  if (cachedTitle !== undefined) {
    return Promise.resolve(cachedTitle);
  }

  const cacheKey = getPluginIssueTitleCacheKey(repository, issueNumber);
  const inFlightTitle = inFlightTitles.get(cacheKey);
  if (inFlightTitle) {
    return inFlightTitle;
  }

  const request = requestIssueTitle(repository, issueNumber);
  inFlightTitles.set(cacheKey, request);
  return request.finally(() => {
    if (inFlightTitles.get(cacheKey) === request) {
      inFlightTitles.delete(cacheKey);
    }
  });
}
