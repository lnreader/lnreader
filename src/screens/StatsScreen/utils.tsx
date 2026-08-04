import { getString } from '@i18n/translations';
import dayjs from 'dayjs';

export function normalizeGenre(genre: string): string {
  return genre.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export function normalizeGenreDistribution(
  genres: Record<string, number>,
): { name: string; count: number }[] {
  const merged: Record<string, number> = {};
  for (const [key, count] of Object.entries(genres)) {
    const normalized = normalizeGenre(key);
    merged[normalized] = (merged[normalized] || 0) + count;
  }
  return Object.entries(merged)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function formatTimeSpent(totalMs: number | undefined) {
  if (totalMs === undefined || totalMs <= 0) {
    return getString('time.seconds', { count: 0 });
  }
  const d = dayjs.duration(totalMs, 'milliseconds');
  const asDays = Math.floor(d.asDays());
  const asHours = Math.floor(d.asHours());
  const asMinutes = Math.floor(d.asMinutes());
  const asSeconds = Math.floor(d.asSeconds());
  const hours = Math.floor(d.hours());
  const minutes = Math.floor(d.minutes());
  const seconds = Math.floor(d.seconds());

  if (asDays >= 1) {
    return hours > 0
      ? `${getString('time.days', { count: asDays })} ${getString('time.hours', { count: hours })}`
      : getString('time.days', { count: asDays });
  }
  if (asHours >= 1) {
    return minutes > 0
      ? `${getString('time.hours', { count: asHours })} ${getString('time.minutes', { count: minutes })}`
      : getString('time.hours', { count: asHours });
  }
  if (asMinutes >= 1) {
    return seconds > 0
      ? `${getString('time.minutes', { count: asMinutes })} ${getString('time.seconds', { count: seconds })}`
      : getString('time.minutes', { count: asMinutes });
  }
  return getString('time.seconds', { count: asSeconds });
}

export function groupGenreDistribution(
  entries: { name: string; count: number }[]
): { category: string; total: number; items: { name: string; count: number; isCategory: boolean }[] }[] {
  const knownRoots = [
    'Fantasy', 'Romance', 'Adventure', 'Action', 'Horror', 'Mystery',
    'Comedy', 'Drama', 'Sci-Fi', 'Fiction', 'Lead', 'Hero',
  ];

  interface Entry {
    name: string;
    count: number;
    normalized: string;
  }

  const normalizedEntries: Entry[] = entries.map(e => ({
    ...e,
    normalized: e.name.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
  }));

  const assigned = new Set<number>();
  const groups: Map<string, { total: number; items: { name: string; count: number; isCategory: boolean }[] }> = new Map();

  // Phase 1: match entries against known roots
  for (const root of knownRoots) {
    const matches = normalizedEntries.filter((e, i) => {
      if (assigned.has(i)) return false;
      if (e.normalized === root) return false; // the root itself
      return e.normalized.includes(root) || root.includes(e.normalized);
    });
    if (matches.length > 0 || normalizedEntries.some((e, i) => !assigned.has(i) && e.normalized === root)) {
      const rootEntry = normalizedEntries.find((e, i) => !assigned.has(i) && e.normalized === root);
      const rootIdx = normalizedEntries.findIndex((e, i) => !assigned.has(i) && e.normalized === root);
      if (rootEntry && rootIdx >= 0) {
        assigned.add(rootIdx);
        const group = groups.get(root) || { total: 0, items: [] };
        group.total += rootEntry.count;
        group.items.push({ name: rootEntry.name, count: rootEntry.count, isCategory: true });
        groups.set(root, group);
      }
      for (const m of matches) {
        const idx = normalizedEntries.indexOf(m);
        assigned.add(idx);
        const group = groups.get(root) || { total: 0, items: [] };
        group.total += m.count;
        group.items.push({ name: m.name, count: m.count, isCategory: false });
        groups.set(root, group);
      }
    }
  }

  // Phase 2: synthetic categories from trailing-word frequency
  const ungrouped = normalizedEntries.filter((_, i) => !assigned.has(i));
  const wordCounts: Map<string, { count: number; indices: number[] }> = new Map();
  for (let i = 0; i < ungrouped.length; i++) {
    const words = ungrouped[i].normalized.split(' ');
    if (words.length > 1) {
      const lastWord = words[words.length - 1];
      const entry = wordCounts.get(lastWord) || { count: 0, indices: [] };
      entry.count++;
      entry.indices.push(normalizedEntries.indexOf(ungrouped[i]));
      wordCounts.set(lastWord, entry);
    }
  }

  for (const [word, info] of wordCounts) {
    if (info.count >= 2) {
      for (const idx of info.indices) {
        if (!assigned.has(idx)) {
          assigned.add(idx);
          const e = normalizedEntries[idx];
          const group = groups.get(word) || { total: 0, items: [] };
          group.total += e.count;
          group.items.push({ name: e.name, count: e.count, isCategory: false });
          groups.set(word, group);
        }
      }
    }
  }

  // Phase 3: leftovers become their own categories
  for (let i = 0; i < normalizedEntries.length; i++) {
    if (!assigned.has(i)) {
      assigned.add(i);
      const e = normalizedEntries[i];
      const group = groups.get(e.name) || { total: 0, items: [] };
      group.total += e.count;
      group.items.push({ name: e.name, count: e.count, isCategory: true });
      groups.set(e.name, group);
    }
  }

  // Sort: categories by total descending, items by count descending with isCategory first
  return Array.from(groups.entries())
    .map(([category, g]) => ({
      category,
      total: g.total,
      items: g.items.sort((a, b) => {
        if (a.isCategory !== b.isCategory) return a.isCategory ? -1 : 1;
        return b.count - a.count;
      }),
    }))
    .sort((a, b) => b.total - a.total);
}
