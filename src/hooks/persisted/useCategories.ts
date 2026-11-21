import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { getCategoriesFromDb } from '@database/queries/CategoryQueries';
import { Category } from '@database/types';

const useCategories = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string>();

  const getCategories = useCallback(async () => {
    try {
      const res = await getCategoriesFromDb();
      setCategories(res);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Refresh after returning from the category editor.
      getCategories();
    }, [getCategories]),
  );

  return {
    isLoading,
    categories,
    error,
  };
};

export default useCategories;
