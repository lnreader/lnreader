import { act, renderHook } from '@testing-library/react-native';

import { db } from '@database/db';
import { useLibraryNovels } from '../useLibrary';

jest.mock('@hooks/persisted', () => ({
  useLibrarySettings: () => ({ sortOrder: 'name ASC' }),
}));

jest.mock('@database/db', () => ({
  db: { executeSync: jest.fn(), reactiveExecute: jest.fn() },
}));

jest.mock('@database/queries/LibraryQueries', () => ({
  getLibraryNovelsQuery: () => ({
    toSQL: () => ({ sql: 'library', params: [] }),
  }),
}));

jest.mock('@database/queries/CategoryQueries', () => ({}));
jest.mock('@database/queries/NovelQueries', () => ({}));
jest.mock('@services/backgroundTasks', () => ({}));
jest.mock('@hooks/persisted/useBackgroundTasks', () => ({}));

describe('useLibraryNovels', () => {
  it('lists saved novels from the first render and follows Novel changes', () => {
    let publish: ((result: { rows: unknown[] }) => void) | undefined;
    (db.executeSync as jest.Mock).mockReturnValue({
      rows: [{ id: 1 }, { id: 2 }],
    });
    (db.reactiveExecute as jest.Mock).mockImplementation(
      ({ fireOn, callback }) => {
        expect(fireOn).toEqual([{ table: 'Novel' }]);
        publish = callback;
        return jest.fn();
      },
    );
    const renders: number[][] = [];

    renderHook(() => {
      renders.push(useLibraryNovels().library.map(novel => novel.id));
    });

    expect(renders[0]).toEqual([1, 2]);

    act(() => publish?.({ rows: [{ id: 2 }] }));

    expect(renders.at(-1)).toEqual([2]);
  });
});
