import { act, renderHook, waitFor } from '@testing-library/react-native';
import type {
  PluginIssueGroup,
  PluginIssueReport,
  PluginIssueRepository,
} from '@plugins/issueIndex';
import type * as IssueMetadata from '@plugins/issueMetadata';
import { usePluginIssueTitles } from '../usePluginIssueTitles';

const mockFetchTimeout = jest.fn();
const mockLoadPluginIssueTitle = jest.fn<
  Promise<string | undefined>,
  [repository: PluginIssueRepository, issueNumber: number]
>();

jest.mock('@utils/fetch/fetch', () => ({
  fetchTimeout: (...args: unknown[]) => mockFetchTimeout(...args),
}));

jest.mock('@plugins/issueMetadata', () => ({
  ...jest.requireActual('@plugins/issueMetadata'),
  loadPluginIssueTitle: (
    repository: PluginIssueRepository,
    issueNumber: number,
  ) => mockLoadPluginIssueTitle(repository, issueNumber),
}));

const loadUnmockedPluginIssueTitle = jest.requireActual<typeof IssueMetadata>(
  '@plugins/issueMetadata',
).loadPluginIssueTitle;

interface IssueHtmlResponse {
  ok: boolean;
  text: () => Promise<string>;
}

const htmlResponse = (html: string): IssueHtmlResponse => ({
  ok: true,
  text: jest.fn().mockResolvedValue(html),
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => {
    resolve = complete;
  });
  return { promise, resolve };
};

const sourceA = { owner: 'source-a', name: 'plugins' };
const sourceB = { owner: 'source-b', name: 'plugins' };
const issueReport = (
  issueNumber: number,
  repository: PluginIssueRepository = sourceA,
): PluginIssueReport => ({ issueNumber, repository });

describe('usePluginIssueTitles', () => {
  beforeEach(() => {
    mockLoadPluginIssueTitle.mockReset();
    mockFetchTimeout.mockReset();
  });

  it('shows a cached later title and publishes later responses before earlier ones', async () => {
    const requests = new Map<number, Deferred<string | undefined>>();
    const report1 = issueReport(1);
    const report2 = issueReport(2);
    const report3 = issueReport(3);
    const report4 = issueReport(4);
    const cachedReport = issueReport(5);
    mockFetchTimeout.mockResolvedValue(
      htmlResponse('<head><title>Cached title 5</title></head>'),
    );
    await loadUnmockedPluginIssueTitle(sourceA, 5);
    mockLoadPluginIssueTitle.mockImplementation((_repository, issueNumber) => {
      const request = deferred<string | undefined>();
      requests.set(issueNumber, request);
      return request.promise;
    });

    const groups: PluginIssueGroup[] = [
      [0, report1, report2, report3, report4, cachedReport, report1, report4],
    ];
    const { result } = renderHook(() => usePluginIssueTitles(groups));

    expect(mockLoadPluginIssueTitle.mock.calls).toEqual([
      [sourceA, 1],
      [sourceA, 2],
      [sourceA, 3],
      [sourceA, 4],
    ]);
    expect(result.current.get(report1)).toBeUndefined();
    expect(result.current.get(report2)).toBeUndefined();
    expect(result.current.get(report3)).toBeUndefined();
    expect(result.current.get(report4)).toBeUndefined();
    expect(result.current.get(cachedReport)).toBe('Cached title 5');

    await act(async () => {
      requests.get(4)?.resolve('Title 4');
      await requests.get(4)?.promise;
    });
    await waitFor(() => expect(result.current.get(report4)).toBe('Title 4'));
    expect(result.current.get(report1)).toBeUndefined();
    expect(result.current.get(report2)).toBeUndefined();
    expect(result.current.get(report3)).toBeUndefined();
    expect(result.current.get(cachedReport)).toBe('Cached title 5');
    expect(mockFetchTimeout).toHaveBeenCalledTimes(1);

    await act(async () => {
      requests.get(1)?.resolve('Title 1');
      requests.get(2)?.resolve(undefined);
      requests.get(3)?.resolve('Title 3');
      await Promise.all([
        requests.get(1)?.promise,
        requests.get(2)?.promise,
        requests.get(3)?.promise,
      ]);
    });
    await waitFor(() => expect(result.current.get(report2)).toBeNull());
    expect(result.current.get(report1)).toBe('Title 1');
    expect(result.current.get(report2)).toBeNull();
    expect(result.current.get(report3)).toBe('Title 3');
    expect(result.current.get(report4)).toBe('Title 4');
    expect(result.current.get(cachedReport)).toBe('Cached title 5');
  });

  it('settles undefined and rejected metadata as unavailable', async () => {
    const report21 = issueReport(21);
    const report22 = issueReport(22);
    mockLoadPluginIssueTitle
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('network unavailable'));
    const groups: PluginIssueGroup[] = [[0, report21, report22]];
    const { result } = renderHook(() => usePluginIssueTitles(groups));

    expect(result.current.get(report21)).toBeUndefined();
    expect(result.current.get(report22)).toBeUndefined();
    await waitFor(() => expect(result.current.get(report22)).toBeNull());
    expect(result.current.get(report21)).toBeNull();
    expect(result.current.get(report22)).toBeNull();
  });

  it('caps workers and does not publish retired results or start queued requests', async () => {
    const requests = new Map<number, Deferred<string | undefined>>();
    mockLoadPluginIssueTitle.mockImplementation((_repository, issueNumber) => {
      const request = deferred<string | undefined>();
      requests.set(issueNumber, request);
      return request.promise;
    });

    const oldReports = [11, 12, 13, 14, 15, 16, 17, 18].map(issueNumber =>
      issueReport(issueNumber),
    );
    const oldGroups: PluginIssueGroup[] = [[0, ...oldReports]];
    const newReport = issueReport(99, sourceB);
    const newGroups: PluginIssueGroup[] = [[3, newReport]];
    const { result, rerender } = renderHook<
      ReadonlyMap<PluginIssueReport, string | null | undefined>,
      PluginIssueGroup[] | undefined
    >(groups => usePluginIssueTitles(groups), { initialProps: oldGroups });

    expect(
      mockLoadPluginIssueTitle.mock.calls.map(([, number]) => number),
    ).toEqual([11, 12, 13, 14, 15, 16]);
    await act(async () => {
      requests.get(11)?.resolve('Retired title');
      await requests.get(11)?.promise;
    });
    expect(
      mockLoadPluginIssueTitle.mock.calls.map(([, number]) => number),
    ).toEqual([11, 12, 13, 14, 15, 16, 17]);
    rerender(newGroups);
    expect(
      mockLoadPluginIssueTitle.mock.calls.map(([, number]) => number),
    ).toEqual([11, 12, 13, 14, 15, 16, 17, 99]);

    await act(async () => {
      for (const issueNumber of [12, 13, 14, 15, 16, 17]) {
        requests.get(issueNumber)?.resolve('Retired title');
      }
      await Promise.all(
        [12, 13, 14, 15, 16, 17].map(
          issueNumber => requests.get(issueNumber)?.promise,
        ),
      );
    });

    expect(
      mockLoadPluginIssueTitle.mock.calls.map(([, number]) => number),
    ).toEqual([11, 12, 13, 14, 15, 16, 17, 99]);
    expect(result.current.size).toBe(1);
    expect(result.current.get(newReport)).toBeUndefined();
    expect(oldReports.every(report => !result.current.has(report))).toBe(true);
  });

  it('loads a shared issue number once per case-insensitive repository identity', async () => {
    const differentlyCasedSourceA = {
      owner: 'SOURCE-A',
      name: 'PLUGINS',
    };
    const sourceAReport = issueReport(42, sourceA);
    const equivalentSourceAReport = issueReport(42, differentlyCasedSourceA);
    const sourceBReport = issueReport(42, sourceB);
    mockLoadPluginIssueTitle.mockImplementation(repository =>
      Promise.resolve(
        repository.owner.toLowerCase() === 'source-a'
          ? 'Source A title'
          : 'Source B title',
      ),
    );
    const groups: PluginIssueGroup[] = [
      [0, sourceAReport, equivalentSourceAReport, sourceBReport],
    ];
    const { result } = renderHook(() => usePluginIssueTitles(groups));

    await waitFor(() =>
      expect(result.current.get(sourceBReport)).toBe('Source B title'),
    );
    expect(mockLoadPluginIssueTitle.mock.calls).toEqual([
      [sourceA, 42],
      [sourceB, 42],
    ]);
    expect(result.current.get(sourceAReport)).toBe('Source A title');
    expect(result.current.get(equivalentSourceAReport)).toBe('Source A title');
    expect(result.current.get(sourceBReport)).toBe('Source B title');
    expect(result.current.size).toBe(3);
  });

  it('does no work for absent or empty groups', () => {
    const { rerender } = renderHook<
      ReadonlyMap<PluginIssueReport, string | null | undefined>,
      PluginIssueGroup[] | undefined
    >(groups => usePluginIssueTitles(groups), { initialProps: undefined });
    expect(mockLoadPluginIssueTitle).not.toHaveBeenCalled();

    rerender([]);
    expect(mockLoadPluginIssueTitle).not.toHaveBeenCalled();
  });
});
