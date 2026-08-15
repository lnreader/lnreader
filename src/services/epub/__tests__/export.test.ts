import NativeFile from '@modules/native-file';
import { epub } from '@modules/nitro-epub';
import type {
  BackgroundTaskMetadata,
  EpubExportData,
} from '@services/backgroundTasks/contracts';
import { exportEpub } from '../export';

jest.mock('@modules/nitro-epub', () => ({
  epub: {
    exportEpub: jest.fn(),
  },
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

const data: EpubExportData = {
  novelName: 'Example Novel',
  destinationUri: '/storage/emulated/0/Download',
  fileName: 'Example Novel.epub',
  chapters: [
    {
      title: 'Chapter 1',
      htmlPath: '/novels/1/1/index.html',
      novelId: '1',
      chapterId: '1',
    },
  ],
  metadata: {
    title: 'Example Novel',
    language: 'en',
    coverPath: '',
    description: '',
    author: '',
    bookId: 'urn:lnreader:test',
    stylesheet: '',
    javascript: '',
  },
};

const createProgressUpdater = () => {
  let metadata: BackgroundTaskMetadata = {
    name: 'Exporting EPUB',
    isRunning: false,
    progress: 0,
    progressText: '',
  };
  return {
    getMetadata: () => metadata,
    updateProgress: jest.fn(transformer => {
      metadata = transformer(metadata);
    }),
  };
};

describe('exportEpub', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1234);
    jest.mocked(epub.exportEpub).mockResolvedValue({
      outputPath: '/mock/caches/epub-export-1234.epub',
      chapterCount: 1,
    });
    jest.mocked(NativeFile.copyFileToDirectory).mockResolvedValue({
      uri: '/storage/emulated/0/Download/Example Novel.epub',
      size: 4096,
    });
    jest.mocked(NativeFile.exists).mockResolvedValue(true);
    jest.mocked(NativeFile.unlink).mockResolvedValue(undefined);
  });

  it('replaces the named destination through NativeFile', async () => {
    const progress = createProgressUpdater();

    await exportEpub(data, progress.updateProgress);

    expect(NativeFile.copyFileToDirectory).toHaveBeenCalledWith(
      '/mock/caches/epub-export-1234.epub',
      '/storage/emulated/0/Download',
      'Example Novel.epub',
      'application/epub+zip',
      true,
    );
    expect(progress.getMetadata()).toMatchObject({
      isRunning: false,
      progress: 1,
      completionText: 'novelScreen.epub.exportSuccess',
    });
  });

  it('rejects an empty destination copy instead of reporting success', async () => {
    jest.mocked(NativeFile.copyFileToDirectory).mockResolvedValue({
      uri: '/storage/emulated/0/Download/Example Novel.epub',
      size: 0,
    });
    const progress = createProgressUpdater();

    await expect(exportEpub(data, progress.updateProgress)).rejects.toThrow(
      'Exported EPUB is empty',
    );

    expect(progress.getMetadata().completionText).toBeUndefined();
    expect(NativeFile.unlink).toHaveBeenCalledWith(
      '/mock/caches/epub-export-1234.epub',
    );
  });

  it('cleans up the generated cache file when destination replacement fails', async () => {
    jest
      .mocked(NativeFile.copyFileToDirectory)
      .mockRejectedValue(new Error('Destination replacement failed'));
    const progress = createProgressUpdater();

    await expect(exportEpub(data, progress.updateProgress)).rejects.toThrow(
      'Destination replacement failed',
    );

    expect(NativeFile.unlink).toHaveBeenCalledWith(
      '/mock/caches/epub-export-1234.epub',
    );
  });
});
