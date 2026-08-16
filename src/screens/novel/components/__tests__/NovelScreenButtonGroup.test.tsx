import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import NovelScreenButtonGroup from '../NovelScreenButtonGroup/NovelScreenButtonGroup';
import { NovelInfo } from '@database/types';
import { ThemeColors } from '@theme/types';

const mockSetNovel = jest.fn();
const mockUpdateNovelCategories = jest.fn();
const mockGetCategoriesWithCount = jest.fn();
const mockRefetchLibrary = jest.fn();

jest.mock('@components/Context/LibraryContext', () => ({
  useLibraryContext: () => ({
    refetchLibrary: mockRefetchLibrary,
  }),
}));

jest.mock('@database/queries/NovelQueries', () => ({
  updateNovelCategories: (...args: unknown[]) =>
    mockUpdateNovelCategories(...args),
}));

jest.mock('@database/queries/CategoryQueries', () => ({
  getCategoriesWithCount: (...args: unknown[]) =>
    mockGetCategoriesWithCount(...args),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@hooks/persisted', () => ({
  useTracker: () => ({ tracker: undefined }),
  useTrackedNovel: () => ({ trackedNovel: undefined }),
  useTheme: () =>
    ({
      primary: '#111111',
      outline: '#222222',
      rippleColor: '#333333',
      onSurface: '#444444',
      surface: '#555555',
      surfaceContainerHigh: '#666666',
      onSurfaceVariant: '#777777',
      scrim: '#000000',
    } as ThemeColors),
}));

jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    supportedAbis: jest.fn().mockResolvedValue(['arm64-v8a']),
  },
}));

jest.mock('@hooks', () => {
  const { useCallback: mockUseCallback, useState: mockUseState } =
    jest.requireActual('react');
  const useBoolean = (defaultValue?: boolean) => {
    const [value, setValue] = mockUseState(!!defaultValue);
    const setTrue = mockUseCallback(() => setValue(true), []);
    const setFalse = mockUseCallback(() => setValue(false), []);
    return {
      value,
      setTrue,
      setFalse,
      toggle: () => setValue((v: boolean) => !v),
    };
  };
  return { useBoolean };
});

jest.mock('@screens/novel/NovelContext', () => ({
  useNovelAction: () => mockSetNovel,
}));

const theme = {
  primary: '#111111',
  outline: '#222222',
  rippleColor: '#333333',
} as ThemeColors;

const baseNovel: NovelInfo = {
  id: 1,
  path: '/test/novel',
  pluginId: 'test-plugin',
  name: 'Test Novel',
  inLibrary: true,
  isLocal: false,
};

const readingCategory = {
  id: 10,
  name: 'Reading',
  sort: 1,
  novelsCount: 0,
};

describe('NovelScreenButtonGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCategoriesWithCount.mockResolvedValue([readingCategory]);
  });

  it('refreshes the library after assigning a new category', async () => {
    render(
      <NovelScreenButtonGroup
        novel={baseNovel}
        theme={theme}
        handleTrackerSheet={jest.fn()}
        handleFollowNovel={jest.fn()}
      />,
    );

    fireEvent(screen.getByText('novelScreen.inLibaray'), 'longPress');
    await screen.findByText(readingCategory.name);
    fireEvent.press(screen.getByText(readingCategory.name));
    fireEvent.press(screen.getByText('common.ok'));

    await waitFor(() =>
      expect(mockUpdateNovelCategories).toHaveBeenCalledWith([1], [10]),
    );
    await waitFor(() => expect(mockRefetchLibrary).toHaveBeenCalled());
    expect(mockSetNovel).not.toHaveBeenCalled();
  });

  it('adds a novel to the library and refreshes it when categories are set', async () => {
    render(
      <NovelScreenButtonGroup
        novel={{ ...baseNovel, inLibrary: false }}
        theme={theme}
        handleTrackerSheet={jest.fn()}
        handleFollowNovel={jest.fn()}
      />,
    );

    fireEvent(screen.getByText('novelScreen.addToLibaray'), 'longPress');
    await screen.findByText(readingCategory.name);
    fireEvent.press(screen.getByText(readingCategory.name));
    fireEvent.press(screen.getByText('common.ok'));

    await waitFor(() =>
      expect(mockUpdateNovelCategories).toHaveBeenCalledWith([1], [10]),
    );
    await waitFor(() => expect(mockRefetchLibrary).toHaveBeenCalled());
    expect(mockSetNovel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, inLibrary: true }),
    );
  });
});
