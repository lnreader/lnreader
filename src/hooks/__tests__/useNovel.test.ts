import './mocks';
import { deleteCachedNovels, useNovel } from '@hooks/persisted/useNovel';
import {
  getCachedNovels as _getCachedNovels,
  deleteCachedNovels as _deleteCachedNovels,
} from '@database/queries/NovelQueries';
import NativeFile from '@modules/native-file'
import { NOVEL_STORAGE } from '@utils/Storages';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { TRACKED_NOVEL_PREFIX } from '@hooks/persisted/useTrackedNovel';
import {
  keyContract,
  novelPersistence,
} from '@hooks/persisted/useNovel/store-helper/contracts';

describe('useNovel (legacy retirement)', () => {
  it('throws with guidance to use store selectors', () => {
    expect(() => useNovel()).toThrow(
      'useNovel has been retired. Access novel domain state/actions via useNovelContext().novelStore selectors.',
    );
  });
});

describe('deleteCachedNovels', () => {
  const cachedNovels = [
    { id: 10, pluginId: 'p1', path: '/n/1', name: 'N1', inLibrary: false },
    { id: 11, pluginId: 'p2', path: '/n/2', name: 'N2', inLibrary: false },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    MMKVStorage.clearAll();
    (_getCachedNovels as jest.Mock).mockResolvedValue(cachedNovels);
    (NativeFile.exists as jest.Mock).mockReturnValue(false);
  });

  it('clears tracked novel and legacy persistence keys for each cached novel', async () => {
    for (const novel of cachedNovels) {
      MMKVStorage.set(`${TRACKED_NOVEL_PREFIX}_${novel.id}`, 'tracked');
      MMKVStorage.set(
        keyContract.pageIndex({
          pluginId: novel.pluginId,
          novelPath: novel.path,
        }),
        4,
      );
      MMKVStorage.set(
        keyContract.settings({
          pluginId: novel.pluginId,
          novelPath: novel.path,
        }),
        JSON.stringify({ filter: [], showChapterTitles: true }),
      );
      MMKVStorage.set(
        keyContract.lastRead({
          pluginId: novel.pluginId,
          novelPath: novel.path,
        }),
        JSON.stringify({ id: 1 }),
      );
    }

    await deleteCachedNovels();

    for (const novel of cachedNovels) {
      expect(MMKVStorage.contains(`${TRACKED_NOVEL_PREFIX}_${novel.id}`)).toBe(
        false,
      );
      expect(
        MMKVStorage.contains(
          keyContract.pageIndex({
            pluginId: novel.pluginId,
            novelPath: novel.path,
          }),
        ),
      ).toBe(false);
      expect(
        MMKVStorage.contains(
          novelPersistence.keys.settings({
            pluginId: novel.pluginId,
            novelPath: novel.path,
          }),
        ),
      ).toBe(false);
      expect(
        MMKVStorage.contains(
          novelPersistence.keys.lastRead({
            pluginId: novel.pluginId,
            novelPath: novel.path,
          }),
        ),
      ).toBe(false);
    }
  });

  it('unlinks novel directory when it exists on disk', async () => {
    (NativeFile.exists as jest.Mock).mockReturnValue(true);

    await deleteCachedNovels();

    for (const novel of cachedNovels) {
      const dir = `${NOVEL_STORAGE}/${novel.pluginId}/${novel.id}`;
      expect(NativeFile.unlink).toHaveBeenCalledWith(dir);
    }
  });

  it('does not call unlink when directory does not exist', async () => {
    (NativeFile.exists as jest.Mock).mockReturnValue(false);

    await deleteCachedNovels();

    expect(NativeFile.unlink).not.toHaveBeenCalled();
  });

  it('calls database cached-novel delete after cleanup', async () => {
    await deleteCachedNovels();

    expect(_deleteCachedNovels).toHaveBeenCalledTimes(1);
  });
});
