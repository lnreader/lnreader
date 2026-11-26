import { renderHook } from '@testing-library/react-native';
import { useMMKVObject } from 'react-native-mmkv';

import { useLibrarySettings } from '../useSettings';

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }),
  useMMKVObject: jest.fn(),
}));

const mockUseMMKVObject = useMMKVObject as jest.Mock;

describe('useLibrarySettings', () => {
  it('changes filter identities only when their content changes', () => {
    let stored: object = {
      filters: { completed: 'exclude' },
      includedGenres: ['horror'],
      lastUsedCategoryId: 1,
    };
    mockUseMMKVObject.mockImplementation(() => [
      JSON.parse(JSON.stringify(stored)),
      jest.fn(),
    ]);
    const { result, rerender } = renderHook(useLibrarySettings);
    const first = result.current;

    stored = { ...stored, lastUsedCategoryId: 2 };
    rerender(undefined);

    expect(result.current.lastUsedCategoryId).toBe(2);
    expect(result.current.filters).toBe(first.filters);
    expect(result.current.includedGenres).toBe(first.includedGenres);
    expect(result.current.excludedGenres).toBe(first.excludedGenres);

    stored = { ...stored, excludedGenres: ['harem'] };
    rerender(undefined);

    expect(result.current.excludedGenres).toEqual(['harem']);
    expect(result.current.filters).toBe(first.filters);
  });
});
