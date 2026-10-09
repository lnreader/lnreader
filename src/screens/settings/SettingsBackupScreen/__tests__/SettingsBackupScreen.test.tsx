import { fireEvent, render, screen } from '@test-utils';
import { type ElementType, type ReactElement, type ReactNode } from 'react';
import { backgroundTasks } from '@services/backgroundTasks';
import SettingsBackupScreen from '../index';

type MockReactModule = {
  Fragment: ElementType;
  createElement: (
    type: ElementType,
    props?: Record<string, unknown> | null,
    ...children: ReactNode[]
  ) => ReactElement;
  useState<T>(initialState: T): [T, (value: T | ((previous: T) => T)) => void];
};

type MockReactNativeModule = {
  Pressable: ElementType;
  Text: ElementType;
  TextInput: ElementType;
  View: ElementType;
};

type MockChildrenProps = { children?: ReactNode };
type MockButtonProps = MockChildrenProps & {
  disabled?: boolean;
  onPress?: () => void;
  title?: string;
};
type MockDialogRootProps = MockChildrenProps & { visible: boolean };
type MockListItemProps = { onPress?: () => void; title: string };
type MockListInfoItemProps = { title: string };
type MockFlatListProps<Item> = {
  data: readonly Item[];
  renderItem: (info: { item: Item; index: number }) => ReactNode;
};

jest.mock('@screens/novel/NovelContext', () => {
  'use no memo';
  const ReactRuntime = jest.requireActual<MockReactModule>('react');
  const NovelContextProvider = ({ children }: MockChildrenProps) => {
    'use no memo';
    return ReactRuntime.createElement(ReactRuntime.Fragment, null, children);
  };
  return { NovelContextProvider };
});

const partialRestoreWarning =
  'Changes already restored will remain if you pause, cancel, or the restore fails.';

jest.mock('@hooks/persisted', () => ({
  useAppSettings() {
    'use no memo';
    return {
      automaticBackupIntervalHours: 0,
      automaticBackupDirectoryName: undefined,
      automaticBackupDirectoryUri: undefined,
      dateFormat: 'default',
      lastAutomaticBackupAt: undefined,
      relativeTimestamps: true,
      setAppSettings: jest.fn(),
    };
  },
  useTheme() {
    'use no memo';
    return {
      background: '#111111',
      error: '#cc0000',
      onSurface: '#222222',
      onSurfaceDisabled: '#666666',
      onSurfaceVariant: '#444444',
      outline: '#555555',
      primary: '#0000cc',
      rippleColor: '#dddddd',
      secondary: '#777777',
    };
  },
}));

jest.mock('@hooks/persisted/useTheme', () => {
  'use no memo';
  return {
    ThemeProvider: ({ children }: MockChildrenProps) => {
      'use no memo';
      return children;
    },
    useTheme() {
      'use no memo';
      return {
        background: '#111111',
        error: '#cc0000',
        onSurface: '#222222',
        onSurfaceDisabled: '#666666',
        onSurfaceVariant: '#444444',
        outline: '#555555',
        primary: '#0000cc',
        rippleColor: '#dddddd',
        secondary: '#777777',
      };
    },
  };
});

jest.mock('@hooks', () => {
  'use no memo';
  const ReactRuntime = jest.requireActual<MockReactModule>('react');
  const useBoolean = () => {
    'use no memo';
    const [value, setValue] = ReactRuntime.useState(false);
    return {
      value,
      setFalse() {
        setValue(false);
      },
      setTrue() {
        setValue(true);
      },
    };
  };

  return { useBoolean };
});

jest.mock('@hooks/persisted/useSelfHost', () => ({
  useSelfHost() {
    'use no memo';
    return {
      host: 'https://backup.example',
      setHost: jest.fn(),
    };
  },
}));

jest.mock('@services/backgroundTasks', () => ({
  backgroundTasks: { enqueue: jest.fn() },
  configureAutomaticBackups: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@modules/native-file', () => ({
  __esModule: true,
  default: {
    ExternalDirectoryPath: '/backups',
    createDocument: jest.fn(),
    pickDirectory: jest.fn(),
    pickDocument: jest.fn().mockResolvedValue('file://local-backup.zip'),
  },
}));

jest.mock('@api/drive', () => ({
  exists: jest.fn().mockResolvedValue({ id: 'drive-root' }),
  getBackups: jest.fn().mockResolvedValue([
    {
      id: 'drive-archive-id',
      name: 'drive-archive.backup',
      createdTime: '2026-09-24T00:00:00.000Z',
    },
  ]),
  makeDir: jest.fn(),
}));

jest.mock('@api/remote', () => ({
  list: jest.fn().mockResolvedValue(['selfhost-archive.backup']),
}));

jest.mock('@utils/fetch/fetch', () => ({
  fetchTimeout: jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue({ name: 'LNReader' }),
  }),
}));

jest.mock('@utils/dateFormat', () => ({
  formatDate: jest.fn(() => 'Sep 24'),
}));

jest.mock('@utils/showToast', () => ({ showToast: jest.fn() }));

jest.mock('@i18n/translations', () => {
  'use no memo';
  return {
    getString(key: string) {
      return key === 'backupScreen.restoreMayBePartial'
        ? 'Changes already restored will remain if you pause, cancel, or the restore fails.'
        : key;
    },
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    getCurrentUser: jest.fn(() => ({ user: { email: 'reader@example.com' } })),
    hasPreviousSignIn: jest.fn(() => true),
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('@components', () => {
  'use no memo';
  const ReactRuntime = jest.requireActual<MockReactModule>('react');
  const { Pressable, Text, View } =
    jest.requireActual<MockReactNativeModule>('react-native');

  const ViewContent = ({ children }: MockChildrenProps) => {
    'use no memo';
    return ReactRuntime.createElement(View, null, children);
  };
  const TextContent = ({ children }: MockChildrenProps) => {
    'use no memo';
    return ReactRuntime.createElement(Text, null, children);
  };
  const Button = ({ children, disabled, onPress, title }: MockButtonProps) => {
    'use no memo';
    return ReactRuntime.createElement(
      Pressable,
      { accessibilityRole: 'button', disabled, onPress },
      title
        ? ReactRuntime.createElement(Text, null, title)
        : ReactRuntime.createElement(Text, null, children),
    );
  };
  const Dialog = {
    Root: ({ children, visible }: MockDialogRootProps) => {
      'use no memo';
      return visible ? ReactRuntime.createElement(View, null, children) : null;
    },
    Header: ViewContent,
    Title: TextContent,
    Description: TextContent,
    Content: ViewContent,
    Actions: ViewContent,
    Action: Button,
    ScrollArea: ViewContent,
  };
  const List = {
    Section: ViewContent,
    SubHeader: TextContent,
    Item: ({ onPress, title }: MockListItemProps) => {
      'use no memo';
      return ReactRuntime.createElement(
        Pressable,
        { accessibilityRole: 'button', onPress },
        ReactRuntime.createElement(Text, null, title),
      );
    },
    InfoItem: ({ title }: MockListInfoItemProps) => {
      'use no memo';
      return ReactRuntime.createElement(Text, null, title);
    },
  };

  return {
    Appbar: () => {
      'use no memo';
      return null;
    },
    Button,
    Dialog,
    EmptyView: () => {
      'use no memo';
      return null;
    },
    List,
    SafeAreaView: ViewContent,
  };
});
jest.mock('react-native-gesture-handler', () => {
  'use no memo';
  const ReactRuntime = jest.requireActual<MockReactModule>('react');
  const { Pressable, View } =
    jest.requireActual<MockReactNativeModule>('react-native');
  const FlatList = <Item,>({ data, renderItem }: MockFlatListProps<Item>) => {
    'use no memo';
    return ReactRuntime.createElement(
      View,
      null,
      data.map((item, index) =>
        ReactRuntime.createElement(
          ReactRuntime.Fragment,
          { key: String(index) },
          renderItem({ item, index }),
        ),
      ),
    );
  };

  return {
    FlatList,
    GestureHandlerRootView: View,
    ScrollView: View,
    TouchableOpacity: Pressable,
  };
});

jest.mock('react-native-safe-area-context', () => {
  'use no memo';
  const ReactRuntime = jest.requireActual<MockReactModule>('react');
  const SafeAreaProvider = ({ children }: MockChildrenProps) => {
    'use no memo';
    return ReactRuntime.createElement(ReactRuntime.Fragment, null, children);
  };
  return { SafeAreaProvider };
});
jest.mock('react-native-paper', () => {
  'use no memo';
  const ReactRuntime = jest.requireActual<MockReactModule>('react');
  const { TextInput } =
    jest.requireActual<MockReactNativeModule>('react-native');
  const PassThrough = ({ children }: MockChildrenProps) => {
    'use no memo';
    return ReactRuntime.createElement(ReactRuntime.Fragment, null, children);
  };
  return { Portal: PassThrough, Provider: PassThrough, TextInput };
});
jest.mock('../Components/BackupOptions', () => ({
  BackupOptionsDialog: () => {
    'use no memo';
    return null;
  },
  BackupOptionsList: () => {
    'use no memo';
    return null;
  },
}));

jest.mock('../Components/AutomaticBackupDialog', () => ({
  __esModule: true,
  AUTOMATIC_BACKUP_LABELS: { 0: 'backupScreen.automaticBackupFrequency' },
  default: () => {
    'use no memo';
    return null;
  },
}));

const driveBackup = {
  id: 'drive-archive-id',
  name: 'drive-archive.backup',
  createdTime: '2026-09-24T00:00:00.000Z',
};

const renderScreen = () =>
  render(
    <SettingsBackupScreen
      navigation={{ goBack: jest.fn() } as never}
      route={{} as never}
    />,
  );

const selectLocalBackup = async () => {
  fireEvent.press(screen.getByText('backupScreen.restoreBackup'));
  await screen.findByText(partialRestoreWarning);
};
const selectDriveBackup = async () => {
  fireEvent.press(screen.getByText('backupScreen.googeDrive'));
  fireEvent.press(await screen.findByText('common.restore'));
  fireEvent.press(await screen.findByText(/drive-archive/));
  await screen.findByText(partialRestoreWarning);
};

const selectSelfHostBackup = async () => {
  fireEvent.press(screen.getByText('backupScreen.selfHost'));
  fireEvent.press(await screen.findByText('common.ok'));
  fireEvent.press(await screen.findByText('common.restore'));
  fireEvent.press(await screen.findByText(/selfhost-archive/));
  await screen.findByText(partialRestoreWarning);
};

const restoreSelections = [
  {
    source: 'local',
    select: selectLocalBackup,
    task: {
      name: 'LOCAL_RESTORE',
      data: { sourceUri: 'file://local-backup.zip' },
    },
  },
  {
    source: 'Drive',
    select: selectDriveBackup,
    task: { name: 'DRIVE_RESTORE', data: driveBackup },
  },
  {
    source: 'self-host',
    select: selectSelfHostBackup,
    task: {
      name: 'SELF_HOST_RESTORE',
      data: {
        host: 'https://backup.example',
        backupFolder: 'selfhost-archive.backup',
      },
    },
  },
];

describe('SettingsBackupScreen restore confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(restoreSelections)(
    'waits for Restore before enqueueing the $source backup and shows the partial warning',
    async ({ select, task }) => {
      renderScreen();

      await select();

      expect(screen.getByText(partialRestoreWarning)).toBeTruthy();
      expect(backgroundTasks.enqueue).not.toHaveBeenCalled();

      fireEvent.press(screen.getByText('common.restore'));

      expect(backgroundTasks.enqueue).toHaveBeenCalledTimes(1);
      expect(backgroundTasks.enqueue).toHaveBeenCalledWith(task);
    },
  );

  it('discards a selected restore when the user cancels', async () => {
    renderScreen();

    await selectLocalBackup();
    fireEvent.press(screen.getByText('common.cancel'));

    expect(backgroundTasks.enqueue).not.toHaveBeenCalled();
    expect(screen.queryByText(partialRestoreWarning)).toBeNull();
    expect(screen.queryByText('common.restore')).toBeNull();
  });
});
