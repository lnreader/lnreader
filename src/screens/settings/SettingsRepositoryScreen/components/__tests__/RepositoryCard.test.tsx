import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@test-utils';

import type { Repository } from '@database/types';

import RepositoryCard from '../RepositoryCard';

const mockTheme = {
  error: '#ba1a1a',
  isDark: false,
  onPrimary: '#ffffff',
  onSurface: '#1d1b20',
  onSurfaceVariant: '#49454f',
  outline: '#79747e',
  primary: '#6750a4',
  rippleColor: 'rgba(0, 0, 0, 0.1)',
  scrim: '#000000',
  secondaryContainer: '#e8def8',
  surface: '#fffbfe',
  surfaceContainerHigh: '#ece6f0',
  surfaceVariant: '#e7e0ec',
};

jest.mock('@hooks/persisted/useTheme', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => mockTheme,
}));

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('@hooks/index', () => {
  const ReactModule = require('react');

  return {
    useBoolean: () => {
      const [value, setValue] = ReactModule.useState(false);

      return {
        value,
        setTrue: () => setValue(true),
        setFalse: () => setValue(false),
      };
    },
  };
});

jest.mock('@components', () => ({
  ConfirmationDialog: jest.requireActual(
    '@components/ConfirmationDialog/ConfirmationDialog',
  ).default,
  IconButtonV2: () => null,
}));

jest.mock('@components/AppErrorBoundary/AppErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@screens/novel/NovelContext', () => ({
  NovelContextProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  const frame = { height: 800, width: 400, x: 0, y: 0 };
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };

  return {
    SafeAreaFrameContext: ReactModule.createContext(frame),
    SafeAreaInsetsContext: ReactModule.createContext(insets),
    SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
    SafeAreaView: ({ children, ...props }: { children: ReactNode }) =>
      ReactModule.createElement(View, props, children),
    initialWindowMetrics: { frame, insets },
    useSafeAreaFrame: () => frame,
    useSafeAreaInsets: () => insets,
  };
});

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const createAnimatedComponent = (component: unknown) => component;

  return {
    useSharedValue: (initialValue: unknown) => ({ value: initialValue }),
    useAnimatedStyle: (factory: () => Record<string, unknown>) => factory(),
    useDerivedValue: (factory: () => unknown) => factory(),
    withTiming: (value: unknown) => value,
    withSpring: (value: unknown) => value,
    interpolateColor: () => 'transparent',
    createAnimatedComponent,
    default: { View, createAnimatedComponent },
    __esModule: true,
  };
});

jest.mock('@i18n/translations', () => ({
  getString: (key: string, values?: { name?: string }) => {
    const strings: Record<string, string> = {
      'common.cancel': 'Cancel',
      'repositories.disable': 'Disable',
      'repositories.disableTitle': 'Disable repository?',
      'repositories.disableWarning': `Stop checking ${values?.name}`,
      'repositories.toggle': `Toggle ${values?.name} repository`,
    };

    return strings[key] ?? key;
  },
}));

jest.mock('../AddRepositoryModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../DeleteRepositoryModal', () => ({
  __esModule: true,
  default: () => null,
}));

const repository: Repository = {
  id: 1,
  url: 'https://github.com/lnreader/plugins/plugins.min.json',
  enabled: true,
};

describe('RepositoryCard', () => {
  it('confirms before disabling an enabled repository', async () => {
    const toggleRepository = jest.fn();

    render(
      <RepositoryCard
        repository={repository}
        refetchRepositories={() => {}}
        toggleRepository={toggleRepository}
        upsertRepository={() => {}}
      />,
    );

    const repositorySwitch = screen.getByRole('switch', {
      name: 'Toggle lnreader/plugins repository',
    });
    expect(repositorySwitch.props.accessibilityState).toEqual({
      checked: true,
    });

    fireEvent.press(repositorySwitch);

    expect(toggleRepository).not.toHaveBeenCalled();
    expect(screen.getByText('Disable repository?')).toBeTruthy();

    const disableAction = screen.getByRole('button', { name: 'Disable' });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    fireEvent.press(disableAction);

    await waitFor(() =>
      expect(toggleRepository).toHaveBeenCalledWith(repository),
    );
  });

  it('re-enables a disabled repository without a confirmation', () => {
    const disabledRepository = { ...repository, enabled: false };
    const toggleRepository = jest.fn();

    render(
      <RepositoryCard
        repository={disabledRepository}
        refetchRepositories={() => {}}
        toggleRepository={toggleRepository}
        upsertRepository={() => {}}
      />,
    );

    const repositorySwitch = screen.getByRole('switch', {
      name: 'Toggle lnreader/plugins repository',
    });
    expect(repositorySwitch.props.accessibilityState).toEqual({
      checked: false,
    });

    fireEvent.press(repositorySwitch);

    expect(toggleRepository).toHaveBeenCalledWith(disabledRepository);
    expect(screen.queryByText('Disable repository?')).toBeNull();
  });
});
