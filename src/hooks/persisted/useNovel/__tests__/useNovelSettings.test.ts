import { act, renderHook } from '@testing-library/react-native';
import { useNovelSettings } from '../../useNovelSettings';

const mockUseNovelValue = jest.fn();
const mockUseNovelAction = jest.fn();

jest.mock('@screens/novel/NovelContext', () => ({
  useNovelValue: (key: string) => mockUseNovelValue(key),
  useNovelAction: (key: string) => mockUseNovelAction(key),
}));

jest.mock('../../useSettings', () => ({
  useAppSettings: () => ({
    defaultChapterSort: 'positionAsc',
  }),
}));

describe('useNovelSettings', () => {
  const baseNovel = {
    id: 1,
    path: '/novels/test',
    pluginId: 'plugin.test',
    name: 'Novel',
    inLibrary: false,
    totalPages: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads selector-backed values and writes through setNovelSettings', async () => {
    const storeSetNovelSettings = jest.fn();
    const storeNovelSettings = {
      sort: 'positionDesc',
      filter: ['read'],
      showChapterTitles: true,
    };

    mockUseNovelValue.mockImplementation(key => {
      if (key === 'novel') return baseNovel;
      if (key === 'novelSettings') return storeNovelSettings;
      return undefined;
    });
    mockUseNovelAction.mockImplementation(key => {
      if (key === 'setNovelSettings') return storeSetNovelSettings;
      return undefined;
    });

    const { result } = renderHook(() => useNovelSettings());

    expect(result.current.sort).toBe('positionDesc');
    expect(result.current.filter).toEqual(['read']);
    expect(result.current.showChapterTitles).toBe(true);

    await act(async () => {
      await result.current.setChapterSort('nameDesc');
    });

    expect(storeSetNovelSettings).toHaveBeenCalledWith({
      showChapterTitles: true,
      sort: 'nameDesc',
      filter: ['read'],
      excludedScanlators: [],
    });
    expect(storeSetNovelSettings).toHaveBeenCalledTimes(1);
  });

  it('persists changes when changing filter', async () => {
    const storeSetNovelSettings = jest.fn();
    const storeNovelSettings = {
      filter: ['read'],
      showChapterTitles: true,
    };

    mockUseNovelValue.mockImplementation(key => {
      if (key === 'novel') return baseNovel;
      if (key === 'novelSettings') return storeNovelSettings;
      return undefined;
    });
    mockUseNovelAction.mockImplementation(key => {
      if (key === 'setNovelSettings') return storeSetNovelSettings;
      return undefined;
    });

    const { result } = renderHook(() => useNovelSettings());

    expect(result.current.sort).toBeUndefined();

    await act(async () => {
      await result.current.setChapterFilter(['downloaded']);
    });

    expect(storeSetNovelSettings).toHaveBeenCalledWith({
      showChapterTitles: true,
      filter: ['downloaded'],
      excludedScanlators: [],
    });
  });

  it('does not write sort/filter settings when novel is absent', async () => {
    const storeSetNovelSettings = jest.fn();

    mockUseNovelValue.mockImplementation(key => {
      if (key === 'novel') return undefined;
      if (key === 'novelSettings') {
        return {
          filter: [],
          showChapterTitles: true,
        };
      }
      return undefined;
    });
    mockUseNovelAction.mockImplementation(key => {
      if (key === 'setNovelSettings') return storeSetNovelSettings;
      return undefined;
    });

    const { result } = renderHook(() => useNovelSettings());

    await act(async () => {
      await result.current.setChapterSort('nameDesc');
      await result.current.setChapterFilter(['read']);
    });

    expect(storeSetNovelSettings).not.toHaveBeenCalled();
  });

  it('preserves newer settings when cycling a filter after rerender', () => {
    let storeNovelSettings = {
      sort: 'positionAsc',
      filter: [] as ['downloaded'] | [],
      showChapterTitles: true,
    };
    const storeSetNovelSettings = jest.fn(nextSettings => {
      storeNovelSettings = nextSettings;
    });

    mockUseNovelValue.mockImplementation(key => {
      if (key === 'novel') return baseNovel;
      if (key === 'novelSettings') return storeNovelSettings;
      return undefined;
    });
    mockUseNovelAction.mockImplementation(key => {
      if (key === 'setNovelSettings') return storeSetNovelSettings;
      return undefined;
    });

    const { result, rerender } = renderHook(() => useNovelSettings());

    act(() => {
      result.current.setChapterSort('nameDesc');
    });
    rerender({});

    act(() => {
      result.current.cycleChapterFilter('downloaded');
    });

    expect(storeSetNovelSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sort: 'nameDesc',
        filter: ['downloaded'],
      }),
    );
  });
});
