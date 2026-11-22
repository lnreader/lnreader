import { act, renderHook, waitFor } from '@test-utils';
import type { Update, UpdateOverview } from '@database/types';
import {
  updateGroupKey,
  useGroupedUpdateChapters,
} from '../useGroupedUpdateChapters';

const mockUnsubscribe = jest.fn();
const mockReactiveExecute = jest.fn(
  (_options: { callback: (result: { rows: UpdateRow[] }) => void }) =>
    mockUnsubscribe,
);
const mockQuery = jest.fn();

jest.mock('@database/db', () => ({
  db: {
    reactiveExecute: (options: Parameters<typeof mockReactiveExecute>[0]) =>
      mockReactiveExecute(options),
  },
}));
jest.mock('@database/queries/ChapterQueries', () => ({
  getGroupedUpdateChaptersQuery: (groups: unknown) => mockQuery(groups),
}));
jest.mock('@hooks/persisted', () => ({}));
jest.mock('@screens/novel/NovelContext', () => ({}));

const date = '2026-11-21';
const overview: UpdateOverview[] = [
  {
    novelId: 1,
    novelName: 'Single',
    novelPath: '/single',
    novelCover: null,
    pluginId: 'example',
    inLibrary: true,
    updatesPerDay: 1,
    updateDate: date,
  },
  {
    novelId: 2,
    novelName: 'Multiple',
    novelPath: '/multiple',
    novelCover: null,
    pluginId: 'example',
    inLibrary: true,
    updatesPerDay: 2,
    updateDate: date,
  },
];

type UpdateRow = Update & { updateDate: string };
const single = { novelId: 1, updateDate: date, id: 1 } as UpdateRow;
const first = { novelId: 2, updateDate: date, id: 2 } as UpdateRow;
const second = { novelId: 2, updateDate: date, id: 3 } as UpdateRow;

it('loads multi-chapter updates on expansion and keeps their download status live', async () => {
  mockQuery
    .mockReturnValueOnce({
      toSQL: () => ({ sql: 'single', params: [] }),
      all: async () => [single],
    })
    .mockReturnValueOnce({
      toSQL: () => ({ sql: 'expanded', params: [] }),
      all: async () => [single, first, second],
    });

  const singleKey = updateGroupKey(1, date);
  const multipleKey = updateGroupKey(2, date);
  const { result, rerender, unmount } = renderHook(
    ({ expanded }: { expanded: ReadonlySet<string> }) =>
      useGroupedUpdateChapters(overview, expanded),
    { initialProps: { expanded: new Set<string>() } },
  );

  await waitFor(() => expect(result.current.get(singleKey)).toEqual([single]));
  expect(mockQuery).toHaveBeenLastCalledWith([[1, date]]);
  expect(result.current.has(multipleKey)).toBe(false);

  rerender({ expanded: new Set([multipleKey]) });
  await waitFor(() =>
    expect(result.current.get(multipleKey)).toEqual([first, second]),
  );
  expect(mockQuery).toHaveBeenLastCalledWith([
    [1, date],
    [2, date],
  ]);

  const downloaded = { ...first, isDownloaded: true };
  const { callback } = mockReactiveExecute.mock.lastCall![0];
  act(() => callback({ rows: [single, downloaded, second] }));
  expect(result.current.get(multipleKey)).toEqual([downloaded, second]);

  unmount();
  expect(mockUnsubscribe).toHaveBeenCalledTimes(2);
});
