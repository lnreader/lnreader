import NativeFile from '@modules/native-file';
import { NOVEL_STORAGE } from '@utils/Storages';
import {
  deleteAllTranslations,
  deleteTranslatedChapter,
  isTranslationFile,
  readTranslatedChapter,
  translatedChapterPath,
  writeTranslatedChapter,
} from '../storage';

const location = { pluginId: 'somePlugin', novelId: 12, chapterId: 34 };
/**
 * Built from NOVEL_STORAGE rather than hardcoded: the point under test is that
 * translations live in the same chapter folder the downloader writes to, not
 * what the storage root happens to resolve to in the test environment.
 */
const chapterDir = `${NOVEL_STORAGE}/somePlugin/12/34`;

// The repo's `clearMocks` sits at the top level of jest.config.js, which Jest
// ignores when `projects` is used, so the shared NativeFile mock accumulates
// calls across tests. Clear it here rather than reading another test's history.
beforeEach(() => {
  jest.clearAllMocks();
});

describe('translatedChapterPath', () => {
  it('sits beside the downloaded original in the chapter folder', () => {
    expect(translatedChapterPath(location, 'en')).toBe(
      `${chapterDir}/index.en.html`,
    );
  });

  it('supports regional language codes', () => {
    expect(translatedChapterPath(location, 'zh-CN')).toContain(
      'index.zh-CN.html',
    );
  });

  it('rejects a language code that would escape the chapter folder', () => {
    expect(() => translatedChapterPath(location, '../../etc')).toThrow();
    expect(() => translatedChapterPath(location, 'en/../..')).toThrow();
    expect(() => translatedChapterPath(location, '')).toThrow();
  });
});

describe('isTranslationFile', () => {
  it('matches translated chapters only', () => {
    expect(isTranslationFile('index.en.html')).toBe(true);
    expect(isTranslationFile('index.zh-CN.html')).toBe(true);
  });

  it('never matches the downloaded original or its assets', () => {
    expect(isTranslationFile('index.html')).toBe(false);
    expect(isTranslationFile('0.b64.png')).toBe(false);
    expect(isTranslationFile('.nomedia')).toBe(false);
  });
});

describe('writeTranslatedChapter', () => {
  it('creates the chapter folder so undownloaded chapters can be translated', async () => {
    await writeTranslatedChapter(location, 'en', '<p>hi</p>');

    expect(NativeFile.mkdir).toHaveBeenCalledWith(chapterDir);
    expect(NativeFile.writeFile).toHaveBeenCalledWith(
      `${chapterDir}/index.en.html`,
      '<p>hi</p>',
    );
  });
});

describe('readTranslatedChapter', () => {
  it('returns the cached translation', async () => {
    (NativeFile.readFile as jest.Mock).mockResolvedValue('<p>bonjour</p>');
    await expect(readTranslatedChapter(location, 'fr')).resolves.toBe(
      '<p>bonjour</p>',
    );
  });

  it('returns undefined when nothing is cached', async () => {
    (NativeFile.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    await expect(
      readTranslatedChapter(location, 'fr'),
    ).resolves.toBeUndefined();
  });
});

describe('deleteTranslatedChapter', () => {
  it('skips the unlink when no translation exists', async () => {
    (NativeFile.exists as jest.Mock).mockResolvedValue(false);
    await deleteTranslatedChapter(location, 'fr');
    expect(NativeFile.unlink).not.toHaveBeenCalled();
  });

  it('unlinks the translation for the given language only', async () => {
    (NativeFile.exists as jest.Mock).mockResolvedValue(true);
    await deleteTranslatedChapter(location, 'fr');
    expect(NativeFile.unlink).toHaveBeenCalledWith(
      `${chapterDir}/index.fr.html`,
    );
  });
});

describe('deleteAllTranslations', () => {
  const dir = (name: string, path: string) => ({
    name,
    path,
    isDirectory: true,
  });
  const file = (name: string, path: string) => ({
    name,
    path,
    isDirectory: false,
  });

  it('removes translations while leaving originals and images intact', async () => {
    (NativeFile.readDir as jest.Mock).mockImplementation(
      async (path: string) => {
        if (path === NOVEL_STORAGE) {
          return [dir('plug', `${NOVEL_STORAGE}/plug`)];
        }
        if (path === `${NOVEL_STORAGE}/plug`) {
          return [dir('1', `${NOVEL_STORAGE}/plug/1`)];
        }
        if (path === `${NOVEL_STORAGE}/plug/1`) {
          return [dir('7', `${NOVEL_STORAGE}/plug/1/7`)];
        }
        if (path === `${NOVEL_STORAGE}/plug/1/7`) {
          return [
            file('index.html', `${NOVEL_STORAGE}/plug/1/7/index.html`),
            file('index.en.html', `${NOVEL_STORAGE}/plug/1/7/index.en.html`),
            file('index.fr.html', `${NOVEL_STORAGE}/plug/1/7/index.fr.html`),
            file('0.b64.png', `${NOVEL_STORAGE}/plug/1/7/0.b64.png`),
          ];
        }
        return [];
      },
    );

    await expect(deleteAllTranslations()).resolves.toBe(2);

    const unlinked = (NativeFile.unlink as jest.Mock).mock.calls.flat();
    expect(unlinked).toEqual([
      `${NOVEL_STORAGE}/plug/1/7/index.en.html`,
      `${NOVEL_STORAGE}/plug/1/7/index.fr.html`,
    ]);
  });

  it('keeps sweeping when a directory cannot be read', async () => {
    (NativeFile.readDir as jest.Mock).mockRejectedValue(new Error('EACCES'));
    await expect(deleteAllTranslations()).resolves.toBe(0);
  });
});
