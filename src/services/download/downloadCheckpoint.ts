export type DownloadCheckpoint = {
  nextIndex: number;
  failures: string[];
};

export const parseDownloadCheckpoint = (
  checkpoint: string | undefined,
  chapterCount: number,
): DownloadCheckpoint => {
  if (!checkpoint) return { nextIndex: 0, failures: [] };

  try {
    const parsed = JSON.parse(checkpoint) as Partial<DownloadCheckpoint>;
    return {
      nextIndex:
        typeof parsed.nextIndex === 'number' &&
        Number.isInteger(parsed.nextIndex)
          ? Math.min(Math.max(parsed.nextIndex, 0), chapterCount)
          : 0,
      failures: Array.isArray(parsed.failures)
        ? parsed.failures.filter(
            (failure): failure is string => typeof failure === 'string',
          )
        : [],
    };
  } catch {
    return { nextIndex: 0, failures: [] };
  }
};
