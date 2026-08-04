/** Explicit parent → children relationships. A genre listed as a parent MUST also be listed
 *  in knownRoots so it is recognized as a top-level category. */
export interface TaxonomyNode {
 parent: string;
 children: string[];
}

export const GENRE_TAXONOMY: TaxonomyNode[] = [
 {
  parent: 'Fantasy',
  children: ['High Fantasy', 'Urban Fantasy', 'Modern Fantasy', 'Portal Fantasy / Isekai'],
 },
 {
  parent: 'Lead',
  children: ['Female Lead', 'Strong Lead', 'Anti-Hero Lead', 'Non-Human Lead', 'Villainous Lead', 'Male Lead'],
 },
 {
  parent: 'Romance',
  children: ['Lesbian Romance', 'Romance Subplot'],
 },
];

