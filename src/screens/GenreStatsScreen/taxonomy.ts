/** Explicit parent → children relationships. Parents and children are matched against novel genres case-/format-insensitively via normalizeGenre in utils.tsx. */
export interface TaxonomyNode {
  parent: string;
  children: string[];
}

export const GENRE_TAXONOMY: TaxonomyNode[] = [
  {
    parent: 'Fantasy',
    children: [
      'High Fantasy',
      'Urban Fantasy',
      'Modern Fantasy',
      'Portal Fantasy / Isekai',
    ],
  },
  {
    parent: 'Lead',
    children: [
      'Female Lead',
      'Strong Lead',
      'Anti-Hero Lead',
      'Non-Human Lead',
      'Villainous Lead',
      'Male Lead',
    ],
  },
  {
    parent: 'Romance',
    children: ['Lesbian Romance', 'Romance Subplot'],
  },
];
