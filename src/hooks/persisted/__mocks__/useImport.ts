const mockUseImport = jest.fn(() => ({
  importNovel: jest.fn(),
  resumeImport: jest.fn(),
  pauseImport: jest.fn(),
  cancelImport: jest.fn(),
}));

export default mockUseImport;
