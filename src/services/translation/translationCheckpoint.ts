/**
 * Resumability for the per-novel translation task.
 *
 * Mirrors the download checkpoint shape deliberately — the queue restarts a
 * task from its checkpoint after the process is killed, and a translation run
 * over a long novel is exactly the case where paying for the same chapters
 * twice would be expensive.
 */
export type TranslationCheckpoint = {
  nextIndex: number;
  failures: string[];
};

export const parseTranslationCheckpoint = (
  checkpoint: string | undefined,
  chapterCount: number,
): TranslationCheckpoint => {
  if (!checkpoint) {
    return { nextIndex: 0, failures: [] };
  }

  try {
    const parsed = JSON.parse(checkpoint) as Partial<TranslationCheckpoint>;
    return {
      nextIndex:
        typeof parsed.nextIndex === 'number' &&
        Number.isInteger(parsed.nextIndex)
          ? // Clamped: a checkpoint written against a longer chapter list
            // must not skip past the end of a shorter one.
            Math.min(Math.max(parsed.nextIndex, 0), chapterCount)
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
