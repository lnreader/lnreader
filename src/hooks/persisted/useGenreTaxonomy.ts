import { useMMKVObject } from 'react-native-mmkv';
import { GENRE_TAXONOMY, TaxonomyNode } from '@screens/GenreStatsScreen/taxonomy';

const TAXONOMY_KEY = 'GENRE_TAXONOMY';

export const useGenreTaxonomy = () => {
  const [taxonomy = GENRE_TAXONOMY, setTaxonomyRaw] =
    useMMKVObject<TaxonomyNode[]>(TAXONOMY_KEY);

  const setTaxonomy = (value: TaxonomyNode[]) => setTaxonomyRaw(value);

  return { taxonomy, setTaxonomy } as const;
};
