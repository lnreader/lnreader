import { act, renderHook } from '@testing-library/react-native';

import { useNovelRefresh } from '../useNovelRefresh';
import { updateNovel } from '@services/updates/LibraryUpdateQueries';
import { useLibraryContext } from '@components/Context/LibraryContext';
import { NovelInfo } from '@database/types';

jest.mock('@services/updates/LibraryUpdateQueries', () => ({
  updateNovel: jest.fn(),
}));

jest.mock('@components/Context/LibraryContext', () => ({
  useLibraryContext: jest.fn(),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

const mockUpdateNovel = updateNovel as jest.MockedFunction<typeof updateNovel>;
const mockUseLibraryContext = useLibraryContext as jest.MockedFunction<
  typeof useLibraryContext
>;

const novel = {
  id: 1,
  name: 'Novel',
  path: '/novel',
  pluginId: 'plugin',
  inLibrary: true,
} as NovelInfo;

describe('useNovelRefresh', () => {
  const reloadNovel = jest.fn().mockResolvedValue(undefined);
  const refetchLibrary = jest.fn().mockResolvedValue(undefined);
  const enqueue = jest.fn();

  beforeEach(() => {
    reloadNovel.mockClear();
    refetchLibrary.mockClear();
    enqueue.mockClear();
    mockUpdateNovel.mockClear();
    mockUpdateNovel.mockResolvedValue(undefined);
    mockUseLibraryContext.mockReturnValue({
      refetchLibrary,
    } as unknown as ReturnType<typeof useLibraryContext>);
  });

  it('refreshes the novel and library after updating a library novel', async () => {
    const { result } = renderHook(() =>
      useNovelRefresh({
        novel,
        downloadNewChapters: false,
        refreshNovelMetadata: false,
        enqueue,
        reloadNovel,
      }),
    );

    await act(result.current.refresh);

    expect(mockUpdateNovel).toHaveBeenCalledWith(
      novel.pluginId,
      novel.path,
      novel.id,
      expect.objectContaining({ enqueue }),
    );
    expect(reloadNovel).toHaveBeenCalledTimes(1);
    expect(refetchLibrary).toHaveBeenCalledTimes(1);
  });

  it('does not refresh the library for a novel outside the library', async () => {
    const { result } = renderHook(() =>
      useNovelRefresh({
        novel: { ...novel, inLibrary: false },
        downloadNewChapters: false,
        refreshNovelMetadata: false,
        enqueue,
        reloadNovel,
      }),
    );

    await act(result.current.refresh);

    expect(reloadNovel).toHaveBeenCalledTimes(1);
    expect(refetchLibrary).not.toHaveBeenCalled();
  });
});
