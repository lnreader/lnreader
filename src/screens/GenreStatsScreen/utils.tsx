import { NovelWithGenres } from '@database/queries/StatsQueries';
import { GENRE_TAXONOMY, TaxonomyNode } from './taxonomy';

export interface GenreTreeNode {
  name: string;
  count: number;
  categoryTotal: number;
  novelIds: number[];
  children?: GenreTreeNode[];
  isCategory: boolean;
}

export function normalizeGenre(genre: string): string {
  const trimmed = genre.trim();
  if (!trimmed) return 'Unknown';

  // Strip non-alphanumeric chars, lower-case, then capitalize first letter.
  // This makes "sci-fi", "sci fi", "scifi", "SCIFI" all produce "Scifi".
  const cleaned = trimmed.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function buildGenreTree(
  novels: NovelWithGenres[],
  taxonomy?: TaxonomyNode[],
): GenreTreeNode[] {
  // Step 1: For each novel, split genres by comma, normalize, collect into Map<genreName, Set<novelId>>
  const genreMap = new Map<string, Set<number>>();

  // normalized name -> original spelling -> occurrence count
  const genreNameVariants = new Map<string, Map<string, number>>();

  // Pick the most common original spelling; ties keep the first-encountered
  // (Map preserves insertion order, so this is deterministic).
  function getDisplayName(variants: Map<string, number>): string {
    let best = '';
    let bestCount = -1;
    for (const [name, count] of variants) {
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    }
    return best;
  }

  for (const novel of novels) {
    if (!novel.genres || novel.genres.trim().length === 0) {
      const unknown = 'Unknown';
      if (!genreMap.has(unknown)) genreMap.set(unknown, new Set());
      genreMap.get(unknown)!.add(novel.id);
      continue;
    }

    const parts = novel.genres.split(/\s*,\s*/);
    for (const part of parts) {
      const normalized = normalizeGenre(part);
      if (!genreMap.has(normalized)) genreMap.set(normalized, new Set());
      genreMap.get(normalized)!.add(novel.id);

      const original = part.trim();
      if (original.length > 0) {
        const variants = genreNameVariants.get(normalized);
        if (variants) {
          variants.set(original, (variants.get(original) ?? 0) + 1);
        } else {
          genreNameVariants.set(normalized, new Map([[original, 1]]));
        }
      }
    }
  }

  const processed = new Set<string>();
  const result: GenreTreeNode[] = [];

  // Step 2: Build taxonomy-based categories (normalize names for matching)
  const activeTaxonomy = taxonomy ?? GENRE_TAXONOMY;
  for (const taxNode of activeTaxonomy) {
    const normalizedParent = normalizeGenre(taxNode.parent);
    const parentEntry = genreMap.get(normalizedParent);

    // Collect novelIds: union of parent + all children that exist in genreMap
    const categoryNovelIds = new Set(parentEntry ?? []);

    const children: GenreTreeNode[] = [];
    for (const childName of taxNode.children) {
      const normalizedChild = normalizeGenre(childName);
      const childNovelIds = genreMap.get(normalizedChild);
      if (!childNovelIds) continue;

      // Add child's novels to category total
      for (const id of childNovelIds) {
        categoryNovelIds.add(id);
      }

      processed.add(normalizedChild);
      children.push({
        name: childName,
        count: childNovelIds.size,
        categoryTotal: childNovelIds.size,
        novelIds: Array.from(childNovelIds),
        isCategory: false,
      });
    }

    // Skip categories with no matching novels at all — neither the parent
    // genre nor any of its children appear in the library.
    if (categoryNovelIds.size === 0) continue;

    processed.add(normalizedParent);

    // Sort children by count descending
    children.sort((a, b) => b.count - a.count);

    result.push({
      name: taxNode.parent,
      count: parentEntry?.size ?? 0,
      categoryTotal: categoryNovelIds.size,
      novelIds: Array.from(categoryNovelIds),
      children: children.length > 0 ? children : undefined,
      isCategory: true,
    });
  }

  // Step 3: Remaining unprocessed genres → standalone
  for (const [genreName, novelIds] of genreMap) {
    if (processed.has(genreName)) continue;
    const variants = genreNameVariants.get(genreName);
    result.push({
      name: variants ? getDisplayName(variants) : genreName,
      count: novelIds.size,
      categoryTotal: novelIds.size,
      novelIds: Array.from(novelIds),
      isCategory: true,
    });
  }

  // Step 4: Sort by categoryTotal descending
  result.sort((a, b) => b.categoryTotal - a.categoryTotal);

  return result;
}

export function getNovelsForGenre(
  novels: NovelWithGenres[],
  genreIds: Set<number>,
): NovelWithGenres[] {
  const novelMap = new Map<number, NovelWithGenres>();
  for (const novel of novels) {
    if (genreIds.has(novel.id)) {
      novelMap.set(novel.id, novel);
    }
  }
  return Array.from(novelMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
