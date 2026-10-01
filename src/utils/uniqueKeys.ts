/** Suffixes repeated keys (`a`, `a#1`, …) so no two children share one. */
export const uniqueKeys = <T>(
  items: readonly T[],
  keyOf: (item: T, index: number) => string,
) => {
  const counts = new Map<string, number>();
  return items.map((item, index) => {
    const key = keyOf(item, index);
    const count = counts.get(key) ?? 0;
    counts.set(key, count + 1);
    return count ? `${key}#${count}` : key;
  });
};
