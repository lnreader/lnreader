/**
 * Helpers for the merge variant of backup restore.
 * Used by _restoreNovelAndChapters / _restoreCategory.
 */

export type RestoreMode = 'overwrite' | 'merge';

export interface RestoreOptions {
  mode?: RestoreMode;
  /**
   * Backup-novel-id → real-DB-novel-id mapping. Populated during novel
   * restore so category mapping can use the live id.
   */
  novelIdMap?: Map<number, number>;
}

export const maxDateString = (
  a: string | null | undefined,
  b: string | null | undefined,
): string | null => {
  if (!a && !b) return null;
  if (!a) return b ?? null;
  if (!b) return a;
  // ISO-8601 strings are lexicographically comparable.
  return a >= b ? a : b;
};

export const orBool = (
  a: boolean | null | undefined,
  b: boolean | null | undefined,
): boolean => Boolean(a) || Boolean(b);

/**
 * `true` only if BOTH sides are still unread.
 * Once either side has been read, the chapter is considered read.
 */
export const andUnread = (
  a: boolean | null | undefined,
  b: boolean | null | undefined,
): boolean => Boolean(a) && Boolean(b);

export const maxNum = (
  a: number | null | undefined,
  b: number | null | undefined,
): number | null => {
  if (a == null && b == null) return null;
  if (a == null) return b!;
  if (b == null) return a;
  return Math.max(a, b);
};

/**
 * Pick the first non-null/undefined/empty value (existing first), falling
 * back to the backup. Used for fields where the user may have curated the
 * local row (e.g. cover/summary) and we should not overwrite their data.
 */
export const preferExisting = <T>(
  existing: T | null | undefined,
  backup: T | null | undefined,
): T | null => {
  if (
    existing !== null &&
    existing !== undefined &&
    existing !== ('' as unknown as T)
  ) {
    return existing;
  }
  return backup ?? null;
};
