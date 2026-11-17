import React from 'react';
import { renderHook } from '@testing-library/react-native';

import { LibraryContextProvider, useLibraryActions } from '../LibraryContext';
import { useLibrary } from '@screens/library/hooks/useLibrary';

jest.mock('@screens/library/hooks/useLibrary', () => ({
  useLibrary: jest.fn(),
}));

jest.mock('@hooks/persisted', () => ({
  useLibrarySettings: () => ({}),
}));

jest.mock('@screens/novel/components/SetCategoriesModal', () => () => null);

const mockUseLibrary = useLibrary as jest.MockedFunction<typeof useLibrary>;

const libraryWith = (overrides: Record<string, unknown>) =>
  ({
    library: [],
    categories: [],
    isLoading: false,
    ...overrides,
  } as unknown as ReturnType<typeof useLibrary>);

describe('useLibraryActions', () => {
  it('keeps its identity across library reloads and calls the latest implementation', async () => {
    const firstRefetch = jest.fn().mockResolvedValue(undefined);
    const latestRefetch = jest.fn().mockResolvedValue(undefined);
    const latestSwitch = jest.fn().mockResolvedValue(true);
    mockUseLibrary.mockReturnValue(
      libraryWith({ refetchLibrary: firstRefetch }),
    );

    const { result, rerender } = renderHook(useLibraryActions, {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <LibraryContextProvider>{children}</LibraryContextProvider>
      ),
    });
    const initialActions = result.current;

    mockUseLibrary.mockReturnValue(
      libraryWith({
        library: [{ id: 1 }],
        refetchLibrary: latestRefetch,
        switchNovelToLibrary: latestSwitch,
      }),
    );
    rerender({});

    expect(result.current).toBe(initialActions);

    await initialActions.refetchLibrary();
    expect(firstRefetch).not.toHaveBeenCalled();
    expect(latestRefetch).toHaveBeenCalledTimes(1);

    await expect(
      initialActions.switchNovelToLibrary('/novel', 'plugin'),
    ).resolves.toBe(true);
    expect(latestSwitch).toHaveBeenCalledWith('/novel', 'plugin');
  });
});
