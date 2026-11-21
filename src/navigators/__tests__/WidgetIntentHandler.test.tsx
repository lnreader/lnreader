import type { ReactNode } from 'react';
import { Linking } from 'react-native';
import { render, waitFor } from '@test-utils';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import { getChapter } from '@database/queries/ChapterQueries';
import { getNovelById } from '@database/queries/NovelQueries';
import { getRandomLibraryNovelFromDb } from '@database/queries/WidgetQueries';
import WidgetIntentHandler, {
  flushPendingWidgetLink,
  isWidgetUrl,
  openWidgetLink,
  parseWidgetUrl,
} from '../WidgetIntentHandler';
import { navigationRef } from '../ShareIntentHandler';

jest.mock('../ShareIntentHandler', () => ({
  navigationRef: { navigate: jest.fn(), isReady: jest.fn(() => true) },
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: jest.fn(),
}));

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({}),
  useLibrarySettings: () => ({ incognitoMode: false }),
}));

// Providers pulled in by @test-utils; the handler renders nothing itself.
jest.mock('@hooks/persisted/useTheme', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => ({}),
}));

jest.mock('@components/AppErrorBoundary/AppErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
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

jest.mock('@screens/novel/NovelContext', () => ({
  NovelContextProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@database/db', () => ({
  db: { reactiveExecute: jest.fn(() => jest.fn()) },
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getChapter: jest.fn(),
}));

jest.mock('@database/queries/NovelQueries', () => ({
  getNovelById: jest.fn(),
}));

jest.mock('@database/queries/WidgetQueries', () => ({
  getRandomLibraryNovelFromDb: jest.fn(),
}));

jest.mock('@services/widgets', () => ({
  scheduleWidgetSync: jest.fn(),
  syncWidgets: jest.fn(),
}));

const navigate = navigationRef.navigate as jest.Mock;
const novel = {
  id: 7,
  name: 'Saltwind Cartographer',
  path: '/n',
  pluginId: 'p',
};
const chapter = { id: 88, novelId: 7, name: 'A Map With No North' };

describe('WidgetIntentHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (navigationRef.isReady as jest.Mock).mockReturnValue(true);
    (getMMKVObject as jest.Mock).mockReturnValue(undefined);
  });

  describe('parseWidgetUrl', () => {
    it('parses the target and query parameters', () => {
      expect(
        parseWidgetUrl('lnreader://widget/chapter?novelId=7&chapterId=88'),
      ).toEqual({
        target: 'chapter',
        params: { novelId: '7', chapterId: '88' },
      });
    });

    it('ignores URLs that did not come from a widget', () => {
      expect(isWidgetUrl('lnreader://repo/add?url=x')).toBe(false);
      expect(parseWidgetUrl('lnreader://repo/add?url=x')).toBeNull();
      expect(parseWidgetUrl('lnreader://widget/')).toBeNull();
    });
  });

  describe('openWidgetLink', () => {
    it('opens the reader at the saved chapter', async () => {
      (getNovelById as jest.Mock).mockReturnValue(novel);
      (getChapter as jest.Mock).mockResolvedValue(chapter);

      await openWidgetLink({
        target: 'chapter',
        params: { novelId: '7', chapterId: '88' },
      });

      expect(getNovelById).toHaveBeenCalledWith(7);
      expect(getChapter).toHaveBeenCalledWith(88);
      expect(navigate).toHaveBeenCalledWith('ReaderStack', {
        screen: 'Chapter',
        params: { novel, chapter },
      });
    });

    it('falls back to the library when the chapter no longer exists', async () => {
      (getNovelById as jest.Mock).mockReturnValue(novel);
      (getChapter as jest.Mock).mockResolvedValue(undefined);

      await openWidgetLink({
        target: 'chapter',
        params: { novelId: '7', chapterId: '88' },
      });

      expect(navigate).toHaveBeenCalledWith('BottomNavigator', {
        screen: 'Library',
      });
    });

    it('opens the Updates tab, or the library when that tab is hidden', async () => {
      await openWidgetLink({ target: 'updates', params: {} });
      expect(navigate).toHaveBeenLastCalledWith('BottomNavigator', {
        screen: 'Updates',
      });

      (getMMKVObject as jest.Mock).mockReturnValue({ showUpdatesTab: false });
      await openWidgetLink({ target: 'updates', params: {} });
      expect(navigate).toHaveBeenLastCalledWith('BottomNavigator', {
        screen: 'Library',
      });
    });

    it('routes the quick actions', async () => {
      await openWidgetLink({ target: 'search', params: {} });
      expect(navigate).toHaveBeenLastCalledWith('GlobalSearchScreen', {});

      await openWidgetLink({ target: 'downloads', params: {} });
      expect(navigate).toHaveBeenLastCalledWith('MoreStack', {
        screen: 'Downloads',
      });

      (getRandomLibraryNovelFromDb as jest.Mock).mockResolvedValue(novel);
      await openWidgetLink({ target: 'random', params: {} });
      expect(navigate).toHaveBeenLastCalledWith('ReaderStack', {
        screen: 'Novel',
        params: novel,
      });
    });
  });

  it('queues a tap that arrives before the navigator is ready', async () => {
    let onUrl: ((event: { url: string }) => void) | undefined;
    jest
      .spyOn(Linking, 'addEventListener')
      .mockImplementation((_type, handler) => {
        onUrl = handler;
        return { remove: jest.fn() } as unknown as ReturnType<
          typeof Linking.addEventListener
        >;
      });
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    (navigationRef.isReady as jest.Mock).mockReturnValue(false);

    render(<WidgetIntentHandler />);
    await waitFor(() => expect(onUrl).toBeDefined());
    onUrl?.({ url: 'lnreader://widget/updates' });
    expect(navigate).not.toHaveBeenCalled();

    (navigationRef.isReady as jest.Mock).mockReturnValue(true);
    flushPendingWidgetLink();
    expect(navigate).toHaveBeenCalledWith('BottomNavigator', {
      screen: 'Updates',
    });
  });
});
