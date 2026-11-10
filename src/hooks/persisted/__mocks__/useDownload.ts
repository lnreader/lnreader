const mockDownloadingChapterIds = new Set<number>();

const useDownload = jest.fn(() => ({
  downloadingChapterIds: mockDownloadingChapterIds,
  resumeDownload: jest.fn(),
  downloadChapter: jest.fn(),
  downloadChapters: jest.fn(),
  pauseDownload: jest.fn(),
  cancelDownload: jest.fn(),
}));

export default useDownload;
