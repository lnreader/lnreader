import { render } from '@testing-library/react-native';
import { useFocusEffect } from '@react-navigation/native';

import UpdatesScreen from '../UpdatesScreen';

const mockGetUpdates = jest.fn();

jest.mock('@components', () => {
  const ReactModule = require('react');

  return {
    EmptyView: () => null,
    ErrorScreenV2: () => null,
    SearchbarV2: () => null,
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

jest.mock('@components/Context/UpdateContext', () => ({
  useUpdateContext: () => ({
    updatesOverview: [],
    getUpdates: mockGetUpdates,
    lastUpdateTime: undefined,
    showLastUpdateTime: true,
    error: '',
  }),
}));

jest.mock('@hooks', () => ({
  useSearch: () => ({
    searchText: '',
    setSearchText: jest.fn(),
    clearSearchbar: jest.fn(),
  }),
}));

jest.mock('@hooks/persisted', () => ({
  useAppSettings: () => ({}),
  useTheme: () => ({
    background: '#000000',
    onPrimary: '#ffffff',
    onSurface: '#ffffff',
    primary: '#000000',
  }),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  deleteChapter: jest.fn(),
}));

jest.mock('@services/backgroundTasks', () => ({
  backgroundTasks: { enqueue: jest.fn() },
}));

jest.mock('@utils/dateFormat', () => ({
  formatDate: (date: string) => date,
}));

jest.mock('../components/UpdateNovelChapterGroup', () => () => null);

const mockUseFocusEffect = useFocusEffect as jest.MockedFunction<
  typeof useFocusEffect
>;

describe('UpdatesScreen', () => {
  beforeEach(() => {
    mockGetUpdates.mockReset();
  });

  it('reloads the update overview when the Updates screen gains focus', () => {
    const navigation = {
      addListener: jest.fn(() => jest.fn()),
      isFocused: jest.fn(() => false),
      navigate: jest.fn(),
    };

    render(
      <UpdatesScreen navigation={navigation as never} route={{} as never} />,
    );

    const focusCallback = mockUseFocusEffect.mock.calls.at(-1)?.[0];
    expect(focusCallback).toBeDefined();

    focusCallback?.();

    expect(mockGetUpdates).toHaveBeenCalledTimes(1);
  });
});
