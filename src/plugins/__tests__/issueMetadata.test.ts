const mockFetchTimeout = jest.fn();

jest.mock('@utils/fetch/fetch', () => ({
  fetchTimeout: (...args: unknown[]) => mockFetchTimeout(...args),
}));

interface IssueHtmlResponse {
  ok: boolean;
  text: () => Promise<string>;
}

const defaultRepository = { owner: 'LNReader', name: 'lnreader-plugins' };
const issueUrl = (
  repository: { owner: string; name: string },
  issueNumber: number,
) =>
  `https://github.com/${repository.owner}/${repository.name}/issues/${issueNumber}`;
const htmlResponse = (html: string): IssueHtmlResponse => ({
  ok: true,
  text: jest.fn().mockResolvedValue(html),
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => {
    resolve = complete;
  });
  return { promise, resolve };
};
const loadIssueMetadata = () => require('../issueMetadata');

describe('plugin issue metadata', () => {
  beforeEach(() => {
    jest.resetModules();
    mockFetchTimeout.mockReset();
  });

  it('builds links to the upstream plugin repository', () => {
    expect(loadIssueMetadata().getPluginIssueUrl(defaultRepository, 2133)).toBe(
      'https://github.com/LNReader/lnreader-plugins/issues/2133',
    );
  });

  it('uses the first nonblank title, preferring Open Graph metadata', async () => {
    mockFetchTimeout.mockResolvedValue(
      htmlResponse(`
        <html><head>
          <meta property="og:title" content="  Open Graph title  ">
          <meta name="twitter:title" content="Twitter title">
          <title>Document title</title>
        </head><body><h1>Issue body should not be parsed</h1></body></html>
      `),
    );

    await expect(
      loadIssueMetadata().loadPluginIssueTitle(defaultRepository, 2133),
    ).resolves.toBe('Open Graph title');
  });

  it('falls back to Twitter and then the document title when earlier values are blank', async () => {
    const { loadPluginIssueTitle } = loadIssueMetadata();
    mockFetchTimeout
      .mockResolvedValueOnce(
        htmlResponse(
          '<head><meta property="og:title" content="  "><meta name="twitter:title" content=" Twitter title "></head>',
        ),
      )
      .mockResolvedValueOnce(
        htmlResponse(
          '<head><meta property="og:title" content="\n"><meta name="twitter:title" content=" "><title> Document title </title></head>',
        ),
      );

    await expect(loadPluginIssueTitle(defaultRepository, 2134)).resolves.toBe(
      'Twitter title',
    );
    await expect(loadPluginIssueTitle(defaultRepository, 2135)).resolves.toBe(
      'Document title',
    );
  });

  it('decodes entities and collapses whitespace in the selected title', async () => {
    mockFetchTimeout.mockResolvedValue(
      htmlResponse(
        '<head><meta property="og:title" content=" A &amp; B\n  title "></head>',
      ),
    );

    await expect(
      loadIssueMetadata().loadPluginIssueTitle(defaultRepository, 2136),
    ).resolves.toBe('A & B title');
  });

  it('removes only the requested issue decoration and preserves title punctuation', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce(
        htmlResponse(
          '<head><meta property="og:title" content="GALAXYNOVELS. · Issue #2667 · lnreader/lnreader-plugins · GitHub"></head>',
        ),
      )
      .mockResolvedValueOnce(
        htmlResponse(
          '<head><title>Novel · Part 2 · Issue #2668 · LNREADER/LNREADER-PLUGINS</title></head>',
        ),
      )
      .mockResolvedValueOnce(
        htmlResponse(
          '<head><title>Novel · Part 2 · Issue #2669 · lnreader/lnreader-plugins-extra</title></head>',
        ),
      );
    const { loadPluginIssueTitle } = loadIssueMetadata();

    await expect(loadPluginIssueTitle(defaultRepository, 2667)).resolves.toBe(
      'GALAXYNOVELS.',
    );
    await expect(loadPluginIssueTitle(defaultRepository, 2668)).resolves.toBe(
      'Novel · Part 2',
    );
    await expect(loadPluginIssueTitle(defaultRepository, 2669)).resolves.toBe(
      'Novel · Part 2 · Issue #2669 · lnreader/lnreader-plugins-extra',
    );
  });
  it('escapes repository paths when stripping issue decoration', async () => {
    const repository = { owner: 'custom-owner', name: 'plugin.tools' };
    mockFetchTimeout
      .mockResolvedValueOnce(
        htmlResponse(
          '<head><title>Decorated title · Issue #2670 · custom-owner/plugin.tools · GitHub</title></head>',
        ),
      )
      .mockResolvedValueOnce(
        htmlResponse(
          '<head><title>Unmatched · Issue #2671 · custom-owner/pluginXtools · GitHub</title></head>',
        ),
      );
    const { loadPluginIssueTitle } = loadIssueMetadata();

    await expect(loadPluginIssueTitle(repository, 2670)).resolves.toBe(
      'Decorated title',
    );
    await expect(loadPluginIssueTitle(repository, 2671)).resolves.toBe(
      'Unmatched · Issue #2671 · custom-owner/pluginXtools · GitHub',
    );
  });

  it('returns undefined for an empty selected title', async () => {
    mockFetchTimeout.mockResolvedValue(
      htmlResponse(
        '<head><meta property="og:title" content=" &nbsp; "><title> </title></head>',
      ),
    );

    await expect(
      loadIssueMetadata().loadPluginIssueTitle(defaultRepository, 2137),
    ).resolves.toBe(undefined);
  });

  it('returns undefined for non-OK responses, missing metadata, and failed requests', async () => {
    mockFetchTimeout
      .mockResolvedValueOnce({ ok: false, text: jest.fn() })
      .mockResolvedValueOnce(
        htmlResponse('<html><head></head><body>None</body></html>'),
      )
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockRejectedValue(new Error('body unavailable')),
      });
    const { loadPluginIssueTitle } = loadIssueMetadata();

    await expect(loadPluginIssueTitle(defaultRepository, 2140)).resolves.toBe(
      undefined,
    );
    await expect(loadPluginIssueTitle(defaultRepository, 2141)).resolves.toBe(
      undefined,
    );
    await expect(loadPluginIssueTitle(defaultRepository, 2142)).resolves.toBe(
      undefined,
    );
    await expect(loadPluginIssueTitle(defaultRepository, 2143)).resolves.toBe(
      undefined,
    );
  });

  it('loads an issue title and open URL from its configured repository', async () => {
    const repository = { owner: 'custom-owner', name: 'custom-plugins' };
    mockFetchTimeout.mockResolvedValue(
      htmlResponse(
        '<head><title>Custom source issue · Issue #42 · custom-owner/custom-plugins · GitHub</title></head>',
      ),
    );
    const {
      getCachedPluginIssueTitle,
      getPluginIssueUrl,
      loadPluginIssueTitle,
    } = loadIssueMetadata();

    await expect(loadPluginIssueTitle(repository, 42)).resolves.toBe(
      'Custom source issue',
    );
    expect(getPluginIssueUrl(repository, 42)).toBe(
      'https://github.com/custom-owner/custom-plugins/issues/42',
    );
    expect(getCachedPluginIssueTitle(repository, 42)).toBe(
      'Custom source issue',
    );
    expect(mockFetchTimeout).toHaveBeenCalledWith(issueUrl(repository, 42), {
      headers: { Accept: 'text/html' },
    });
  });

  it('keeps same-number title requests and cache entries separate by repository', async () => {
    const repositoryA = { owner: 'source-a', name: 'plugins' };
    const repositoryB = { owner: 'source-b', name: 'plugins' };
    const responseA = deferred<IssueHtmlResponse>();
    const responseB = deferred<IssueHtmlResponse>();
    mockFetchTimeout.mockImplementation((url: string) =>
      url === issueUrl(repositoryA, 42) ? responseA.promise : responseB.promise,
    );
    const { getCachedPluginIssueTitle, loadPluginIssueTitle } =
      loadIssueMetadata();

    const titleA = loadPluginIssueTitle(repositoryA, 42);
    const duplicateA = loadPluginIssueTitle(repositoryA, 42);
    const titleB = loadPluginIssueTitle(repositoryB, 42);

    expect(mockFetchTimeout.mock.calls.map(([url]) => url)).toEqual([
      issueUrl(repositoryA, 42),
      issueUrl(repositoryB, 42),
    ]);
    responseB.resolve(
      htmlResponse('<head><title>Source B issue</title></head>'),
    );
    await expect(titleB).resolves.toBe('Source B issue');
    expect(getCachedPluginIssueTitle(repositoryB, 42)).toBe('Source B issue');
    expect(getCachedPluginIssueTitle(repositoryA, 42)).toBeUndefined();

    responseA.resolve(
      htmlResponse('<head><title>Source A issue</title></head>'),
    );
    await expect(Promise.all([titleA, duplicateA])).resolves.toEqual([
      'Source A issue',
      'Source A issue',
    ]);
    expect(getCachedPluginIssueTitle(repositoryA, 42)).toBe('Source A issue');
    expect(getCachedPluginIssueTitle(repositoryB, 42)).toBe('Source B issue');
    expect(
      getCachedPluginIssueTitle({ owner: 'SOURCE-A', name: 'PLUGINS' }, 42),
    ).toBe('Source A issue');
    await expect(
      loadPluginIssueTitle({ owner: 'SOURCE-A', name: 'PLUGINS' }, 42),
    ).resolves.toBe('Source A issue');
    await expect(loadPluginIssueTitle(repositoryA, 42)).resolves.toBe(
      'Source A issue',
    );
    await expect(loadPluginIssueTitle(repositoryB, 42)).resolves.toBe(
      'Source B issue',
    );
    expect(mockFetchTimeout).toHaveBeenCalledTimes(2);
  });

  it('caches successful titles and sends the HTML accept header', async () => {
    mockFetchTimeout.mockResolvedValue(
      htmlResponse('<head><title>Cached title</title></head>'),
    );
    const { loadPluginIssueTitle } = loadIssueMetadata();

    await expect(loadPluginIssueTitle(defaultRepository, 2144)).resolves.toBe(
      'Cached title',
    );
    await expect(loadPluginIssueTitle(defaultRepository, 2144)).resolves.toBe(
      'Cached title',
    );

    expect(mockFetchTimeout).toHaveBeenCalledTimes(1);
    expect(mockFetchTimeout).toHaveBeenCalledWith(
      issueUrl(defaultRepository, 2144),
      { headers: { Accept: 'text/html' } },
    );
  });

  it('coalesces overlapping loads for the same repository issue', async () => {
    const response = deferred<IssueHtmlResponse>();
    mockFetchTimeout.mockReturnValue(response.promise);
    const { loadPluginIssueTitle } = loadIssueMetadata();

    const first = loadPluginIssueTitle(defaultRepository, 2145);
    const second = loadPluginIssueTitle(defaultRepository, 2145);
    expect(mockFetchTimeout).toHaveBeenCalledTimes(1);

    response.resolve(htmlResponse('<head><title>Shared title</title></head>'));
    await expect(Promise.all([first, second])).resolves.toEqual([
      'Shared title',
      'Shared title',
    ]);
  });

  it('retries after an unsuccessful request', async () => {
    mockFetchTimeout
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(
        htmlResponse('<head><title>Recovered title</title></head>'),
      );
    const { loadPluginIssueTitle } = loadIssueMetadata();

    await expect(loadPluginIssueTitle(defaultRepository, 2146)).resolves.toBe(
      undefined,
    );
    await expect(loadPluginIssueTitle(defaultRepository, 2146)).resolves.toBe(
      'Recovered title',
    );
    expect(mockFetchTimeout).toHaveBeenCalledTimes(2);
  });
});
