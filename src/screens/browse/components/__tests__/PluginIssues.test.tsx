import type { ReactNode } from 'react';

import { StyleSheet } from 'react-native';

import { act, fireEvent, render, screen, waitFor } from '@test-utils';
import * as Linking from 'expo-linking';
import { getString } from '@i18n/translations';
import { Provider as PaperProvider } from 'react-native-paper';
import { defaultTheme } from '@theme/md3/defaultTheme';
import {
  pluginIssueIndexStore,
  type PluginIssueIndex,
} from '@plugins/issueIndex';
import type { BrowseScreenProps } from '@navigators/types';
import type { PluginItem } from '@plugins/types';
import type { ThemeColors } from '@theme/types';
import { showToast } from '@utils/showToast';
import { PluginIssueIndicator } from '../PluginIssueIndicator';
import { PluginIssuesSection } from '../PluginIssuesSection';
import { PluginsTab } from '../PluginsTab';
import { SourcesTab } from '../SourcesTab';

const mockFetch = jest.fn();
const mockOpenURL = jest.mocked(Linking.openURL);
const issue2133Title = 'Chapter page shows the wrong language';
const issue2667Title = 'GALAXYNOVELS Always shows 30 chapters ONLY.';
const issueMetadataHtml = {
  2133: '<html><head><meta property="og:title" content="Chapter page shows the wrong language · Issue #2133 · lnreader/lnreader-plugins"></head><body>Issue body text</body></html>',
  2667: '<html><head><meta property="og:title" content="GALAXYNOVELS Always shows 30 chapters ONLY. · Issue #2667 · lnreader/lnreader-plugins · GitHub"></head><body>Issue body text</body></html>',
};

jest.mock('@utils/fetch/fetch', () => ({
  fetchTimeout: (url: string, init?: RequestInit) => mockFetch(url, init),
}));

interface MockBoundaryProps {
  children: ReactNode;
}

jest.mock('@components/AppErrorBoundary/AppErrorBoundary', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: function MockAppErrorBoundary({ children }: MockBoundaryProps) {
      return React.createElement(React.Fragment, null, children);
    },
  };
});

jest.mock('@screens/novel/NovelContext', () => {
  const React = require('react');

  return {
    NovelContextProvider: function MockNovelContextProvider({
      children,
    }: MockBoundaryProps) {
      return React.createElement(React.Fragment, null, children);
    },
  };
});

let mockDisableLoadingAnimations = false;
let mockInstalledPlugins: PluginItem[] = [];
let mockAvailablePlugins: PluginItem[] = [];
const mockPluginActions = {
  installPlugin: jest.fn(),
  refreshPlugins: jest.fn(),
  setLastUsedPluginId: jest.fn(),
  togglePinPlugin: jest.fn(),
  updatePlugin: jest.fn(),
};
interface MockListItem {
  key: string;
}

interface MockListProps<Item extends MockListItem> {
  data: Item[];
  renderItem: (props: { item: Item; index: number }) => ReactNode;
}

interface MockMaterialIconProps {
  color: string;
  name: string;
  size: number;
}

jest.mock('@hooks/persisted', () => ({
  useAppSettings: () => ({
    disableLoadingAnimations: mockDisableLoadingAnimations,
  }),
  useBrowseSettings: () => ({ showAniList: false, showMyAnimeList: false }),
  useFilteredAvailablePlugins: () => mockAvailablePlugins,
  useFilteredInstalledPlugins: () => mockInstalledPlugins,
  useInstalledPlugins: () => mockInstalledPlugins,
  useLastUsedPluginId: () => undefined,
  usePinnedPlugins: () => [],
  useTheme: () => mockPaperTheme,
  usePluginActions: () => mockPluginActions,
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));
jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}));

jest.mock('@legendapp/list/react-native', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    LegendList: function LegendList<Item extends MockListItem>({
      data,
      renderItem,
    }: MockListProps<Item>) {
      return React.createElement(
        View,
        null,
        ...data.map((item, index) =>
          React.createElement(
            React.Fragment,
            { key: item.key },
            renderItem({ item, index }),
          ),
        ),
      );
    },
  };
});

jest.mock('@react-native-vector-icons/material-design-icons', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: function MockMaterialDesignIcon({
      name,
      size,
      color,
    }: MockMaterialIconProps) {
      return React.createElement(View, {
        testID: `plugin-issue-icon-${name}`,
        name,
        size,
        color,
      });
    },
  };
});

const theme = {
  error: '#d32f2f',
  onPrimary: '#ffffff',
  onSurface: '#111111',
  onSurfaceVariant: '#616161',
  primary: '#1565c0',
  rippleColor: '#555555',
  surfaceVariant: '#dddddd',
  tertiary: '#7e57c2',
  outlineVariant: '#bdbdbd',
} as ThemeColors;

const mockPaperTheme = {
  ...defaultTheme.light,
  id: 0,
  rippleColor: '#555555',
} as ThemeColors;

const galaxyPlugin = {
  hasUpdate: true,
  iconUrl: 'https://example.com/galaxy.png',
  id: 'galaxynovels',
  lang: 'en',
  name: 'Galaxy Novels',
  site: 'https://galaxy.example.com',
  version: '1.0.0',
} as PluginItem;

const novelUpdatesPlugin = {
  hasUpdate: false,
  iconUrl: 'https://example.com/novelupdates.png',
  id: 'novelupdates',
  lang: 'en',
  name: 'Novel Updates',
  site: 'https://novelupdates.example.com',
  version: '1.0.0',
} as PluginItem;

const emptyPlugin = {
  hasUpdate: false,
  iconUrl: 'https://example.com/empty.png',
  id: 'emptyplugin',
  lang: 'en',
  name: 'Empty Plugin',
  site: 'https://empty.example.com',
  version: '1.0.0',
} as PluginItem;

const unindexedPlugin = {
  hasUpdate: false,
  iconUrl: 'https://example.com/unindexed.png',
  id: 'unindexedplugin',
  lang: 'en',
  name: 'Unindexed Plugin',
  site: 'https://unindexed.example.com',
  version: '1.0.0',
} as PluginItem;

const defaultIssueRepository = {
  owner: 'LNReader',
  name: 'lnreader-plugins',
};
const issueReport = (
  issueNumber: number,
  repository = defaultIssueRepository,
) => ({ issueNumber, repository });
const fixture: PluginIssueIndex = {
  galaxynovels: [
    [6, issueReport(2133)],
    [3, issueReport(2667)],
  ],
  novelupdates: [[0, issueReport(729), issueReport(736)]],
  emptyplugin: [],
};

const setIssueSnapshot = (index: PluginIssueIndex | undefined) => {
  act(() => {
    pluginIssueIndexStore.setState({
      index,
      isRefreshing: false,
      refreshFailed: false,
    });
  });
};

const renderBrowseTabs = (navigation: BrowseScreenProps['navigation']) => (
  <>
    <PluginsTab navigation={navigation} searchText="" theme={theme} />
    <SourcesTab
      navigation={navigation}
      onOpenPlugins={jest.fn()}
      searchText=""
      theme={theme}
    />
  </>
);
const getTitleSkeleton = (issueNumber: number) =>
  screen.getByTestId(`plugin-issue-title-loading-${issueNumber}`, {
    includeHiddenElements: true,
  });

const queryTitleSkeleton = (issueNumber: number) =>
  screen.queryByTestId(`plugin-issue-title-loading-${issueNumber}`, {
    includeHiddenElements: true,
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockDisableLoadingAnimations = false;
  mockFetch.mockReset().mockResolvedValue({
    ok: false,
    text: jest.fn(),
  });
  mockInstalledPlugins = [galaxyPlugin, emptyPlugin, unindexedPlugin];
  mockAvailablePlugins = [novelUpdatesPlugin];
  setIssueSnapshot(undefined);
});

afterEach(() => {
  setIssueSnapshot(undefined);
});

describe('PluginIssueIndicator in browse lists', () => {
  it('shows fixture categories on plugin and source rows, including available plugins', () => {
    setIssueSnapshot(fixture);
    const navigation = {
      navigate: jest.fn(),
    } as unknown as BrowseScreenProps['navigation'];

    render(renderBrowseTabs(navigation), { wrapper: PaperProvider });

    expect(
      screen.getAllByRole('image', {
        name: 'Reported issues for Galaxy Novels: Domain Changed',
      }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('image', {
        name: 'Reported issues for Novel Updates: Other',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('image', {
        name: 'Reported issues for Empty Plugin: Other',
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('image', {
        name: 'Reported issues for Unindexed Plugin: Other',
      }),
    ).toBeNull();

    const domainChangedIcons = screen.getAllByTestId(
      'plugin-issue-icon-web-off',
    );
    expect(domainChangedIcons).toHaveLength(2);
    domainChangedIcons.forEach(icon => {
      expect(icon.props).toMatchObject({
        color: theme.error,
        name: 'web-off',
      });
    });
    expect(
      screen.getByTestId('plugin-issue-icon-information-outline').props,
    ).toMatchObject({
      color: theme.onSurfaceVariant,
      name: 'information-outline',
    });
    expect(
      screen.queryByRole('button', {
        name: 'Reported issues for Galaxy Novels: Domain Changed',
      }),
    ).toBeNull();
  });

  it('updates mounted plugin and source indicators when snapshots change', () => {
    setIssueSnapshot(fixture);
    const navigation = {
      navigate: jest.fn(),
    } as unknown as BrowseScreenProps['navigation'];
    render(renderBrowseTabs(navigation), { wrapper: PaperProvider });

    expect(
      screen.getAllByRole('image', {
        name: 'Reported issues for Galaxy Novels: Domain Changed',
      }),
    ).toHaveLength(2);

    setIssueSnapshot({
      ...fixture,
      galaxynovels: [[3, issueReport(2667)]],
    });
    expect(
      screen.getAllByRole('image', {
        name: 'Reported issues for Galaxy Novels: Missing Chapter',
      }),
    ).toHaveLength(2);
    const missingChapterIcons = screen.getAllByTestId(
      'plugin-issue-icon-book-minus-outline',
    );
    missingChapterIcons.forEach(icon => {
      expect(icon.props).toMatchObject({
        color: theme.tertiary,
        name: 'book-minus-outline',
      });
    });
    expect(
      screen.queryByRole('image', {
        name: 'Reported issues for Galaxy Novels: Domain Changed',
      }),
    ).toBeNull();

    setIssueSnapshot({});
    expect(
      screen.queryByRole('image', {
        name: 'Reported issues for Galaxy Novels: Missing Chapter',
      }),
    ).toBeNull();
  });

  it('follows the current plugin id when the indicator is rerendered', () => {
    setIssueSnapshot(fixture);
    const { rerender } = render(
      <PluginIssueIndicator
        pluginId="galaxynovels"
        pluginName="Galaxy Novels"
        theme={theme}
      />,
      { wrapper: PaperProvider },
    );

    expect(
      screen.getByRole('image', {
        name: 'Reported issues for Galaxy Novels: Domain Changed',
      }),
    ).toBeOnTheScreen();

    rerender(
      <PluginIssueIndicator
        pluginId="novelupdates"
        pluginName="Novel Updates"
        theme={theme}
      />,
    );
    expect(
      screen.getByRole('image', {
        name: 'Reported issues for Novel Updates: Other',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('image', {
        name: 'Reported issues for Galaxy Novels: Domain Changed',
      }),
    ).toBeNull();
  });

  it('renders no indicator before a successful issue snapshot', () => {
    setIssueSnapshot(undefined);
    render(
      <PluginIssueIndicator
        pluginId="galaxynovels"
        pluginName="Galaxy Novels"
        theme={theme}
      />,
      { wrapper: PaperProvider },
    );

    expect(screen.queryByRole('image')).toBeNull();
  });

  it('preserves plugin and source row actions', async () => {
    setIssueSnapshot(fixture);
    const navigation = {
      navigate: jest.fn(),
    } as unknown as BrowseScreenProps['navigation'];
    render(renderBrowseTabs(navigation), {
      wrapper: PaperProvider,
    });
    mockPluginActions.updatePlugin.mockResolvedValue('2.0.0');
    mockPluginActions.installPlugin.mockResolvedValue(undefined);

    fireEvent.press(screen.getByLabelText('Open details for Galaxy Novels'));
    expect(navigation.navigate).toHaveBeenCalledWith('PluginDetails', {
      pluginId: galaxyPlugin.id,
    });
    fireEvent.press(screen.getByLabelText('Open settings for Galaxy Novels'));
    expect(navigation.navigate).toHaveBeenNthCalledWith(2, 'PluginDetails', {
      pluginId: galaxyPlugin.id,
    });
    fireEvent.press(screen.getByLabelText('Update Galaxy Novels'));
    await waitFor(() =>
      expect(mockPluginActions.updatePlugin).toHaveBeenCalledWith(galaxyPlugin),
    );
    expect(mockPluginActions.updatePlugin).toHaveBeenCalledWith(galaxyPlugin);

    fireEvent.press(
      screen.getByLabelText('Open the website for Novel Updates'),
    );
    expect(navigation.navigate).toHaveBeenCalledWith('WebviewScreen', {
      name: novelUpdatesPlugin.name,
      url: novelUpdatesPlugin.site,
      pluginId: novelUpdatesPlugin.id,
    });
    fireEvent.press(screen.getByLabelText('Install Novel Updates'));
    await waitFor(() =>
      expect(mockPluginActions.installPlugin).toHaveBeenCalledWith(
        novelUpdatesPlugin,
      ),
    );
    expect(mockPluginActions.installPlugin).toHaveBeenCalledWith(
      novelUpdatesPlugin,
    );

    fireEvent.press(
      screen.getByLabelText(`${getString('browse')} ${galaxyPlugin.name}`),
    );
    expect(navigation.navigate).toHaveBeenCalledWith(
      'SourceScreen',
      expect.objectContaining({ pluginId: galaxyPlugin.id }),
    );
    fireEvent.press(
      screen.getByLabelText(
        `${getString('browseScreen.latest')} ${galaxyPlugin.name}`,
      ),
    );
    expect(mockPluginActions.setLastUsedPluginId).toHaveBeenCalledWith(
      galaxyPlugin.id,
    );
    expect(navigation.navigate).toHaveBeenCalledWith(
      'SourceScreen',
      expect.objectContaining({
        pluginId: galaxyPlugin.id,
        showLatestNovels: true,
      }),
    );
    fireEvent.press(
      screen.getByLabelText(
        getString('browseScreen.pinSource', { name: galaxyPlugin.name }),
      ),
    );
    expect(mockPluginActions.togglePinPlugin).toHaveBeenCalledWith(
      galaxyPlugin.id,
    );
  });
});

describe('PluginIssuesSection in plugin details', () => {
  it('renders every category and issue link in producer order', async () => {
    setIssueSnapshot(fixture);
    render(<PluginIssuesSection pluginId="galaxynovels" />, {
      wrapper: PaperProvider,
    });

    expect(
      screen.getByRole('header', { name: 'Reported issues' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Domain Changed' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Missing Chapter' }),
    ).toBeOnTheScreen();

    expect(
      screen.getAllByRole('header').map(header => header.props.children),
    ).toEqual(['Reported issues', 'Domain Changed', 'Missing Chapter']);
    expect(screen.getByTestId('plugin-issue-icon-web-off').props.color).toBe(
      mockPaperTheme.error,
    );
    expect(
      screen.getByTestId('plugin-issue-icon-book-minus-outline').props.color,
    ).toBe(mockPaperTheme.tertiary);
    expect(screen.getAllByTestId('plugin-issue-icon-open-in-new')).toHaveLength(
      2,
    );
    const issueLinks = screen.getAllByRole('link');
    expect(issueLinks.map(link => link.props.accessibilityLabel)).toEqual([
      'Open issue #2133',
      'Open issue #2667',
    ]);
    expect(
      screen.getByRole('link', { name: 'Open issue #2133' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Open issue #2667' }),
    ).toBeOnTheScreen();
    await waitFor(() => {
      expect(queryTitleSkeleton(2133)).toBeNull();
      expect(queryTitleSkeleton(2667)).toBeNull();
    });

    fireEvent.press(screen.getByRole('link', { name: 'Open issue #2667' }));
    await waitFor(() =>
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://github.com/LNReader/lnreader-plugins/issues/2667',
      ),
    );
    mockOpenURL.mockRejectedValueOnce(new Error('Link unavailable'));
    fireEvent.press(screen.getByRole('link', { name: 'Open issue #2133' }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        getString('browseScreen.issueIndex.openFailed', { issueNumber: 2133 }),
      ),
    );
    expect(screen.getByText('#2133')).toBeOnTheScreen();
  });

  it('distinguishes unavailable, empty, and retained cached reports', async () => {
    setIssueSnapshot(undefined);
    const { rerender } = render(
      <PluginIssuesSection pluginId="galaxynovels" />,
      { wrapper: PaperProvider },
    );
    expect(
      screen.getByText('Indexed reports are unavailable.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('No indexed reports.')).toBeNull();

    setIssueSnapshot({});
    rerender(<PluginIssuesSection pluginId="galaxynovels" />);
    expect(screen.getByText('No indexed reports.')).toBeOnTheScreen();
    expect(screen.queryByText('Indexed reports are unavailable.')).toBeNull();

    act(() => {
      pluginIssueIndexStore.setState({
        index: {},
        isRefreshing: false,
        refreshFailed: true,
      });
    });
    rerender(<PluginIssuesSection pluginId="galaxynovels" />);
    expect(
      screen.getByText('Reports could not be refreshed. Showing cached data.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('No indexed reports.')).toBeOnTheScreen();

    act(() => {
      pluginIssueIndexStore.setState({
        index: fixture,
        isRefreshing: true,
        refreshFailed: false,
      });
    });
    rerender(<PluginIssuesSection pluginId="galaxynovels" />);
    expect(
      screen.getByLabelText(getString('common.loading')),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Open issue #2133' }),
    ).toBeOnTheScreen();

    act(() => {
      pluginIssueIndexStore.setState({
        index: fixture,
        isRefreshing: false,
        refreshFailed: true,
      });
    });
    rerender(<PluginIssuesSection pluginId="galaxynovels" />);
    expect(
      screen.getByText('Reports could not be refreshed. Showing cached data.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Open issue #2133' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Open issue #2667' }),
    ).toBeOnTheScreen();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    await act(async () => {
      await Promise.all(
        mockFetch.mock.results.map(result => result.value as Promise<Response>),
      );
    });
  });

  it('uses the shared refresh action for retries and reports failures', async () => {
    setIssueSnapshot(undefined);
    let finishRefresh!: () => void;
    const refreshPromise = new Promise<void>(resolve => {
      finishRefresh = resolve;
    });
    mockPluginActions.refreshPlugins.mockReturnValueOnce(refreshPromise);
    render(<PluginIssuesSection pluginId="galaxynovels" />, {
      wrapper: PaperProvider,
    });

    expect(
      screen.getByRole('button', { name: 'Refresh plugins and reports' }),
    ).toBeEnabled();
    expect(screen.queryByText('Refresh plugins and reports')).toBeNull();
    fireEvent.press(
      screen.getByRole('button', { name: 'Refresh plugins and reports' }),
    );
    expect(
      screen.getByRole('button', { name: 'Refresh plugins and reports' }),
    ).toBeDisabled();
    await act(async () => {
      finishRefresh();
      await refreshPromise;
    });
    expect(mockPluginActions.refreshPlugins).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Refresh plugins and reports' }),
    ).toBeEnabled();

    mockPluginActions.refreshPlugins.mockRejectedValueOnce(
      new Error('Manifest refresh failed'),
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Refresh plugins and reports' }),
    );
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Manifest refresh failed'),
    );
    mockPluginActions.refreshPlugins.mockRejectedValueOnce(
      'Manifest refresh rejected',
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Refresh plugins and reports' }),
    );
    await waitFor(() =>
      expect(showToast).toHaveBeenNthCalledWith(2, 'Manifest refresh rejected'),
    );
  });

  it('disables refresh while the report request is already refreshing', () => {
    act(() => {
      pluginIssueIndexStore.setState({
        index: undefined,
        isRefreshing: true,
        refreshFailed: false,
      });
    });
    render(<PluginIssuesSection pluginId="galaxynovels" />, {
      wrapper: PaperProvider,
    });

    expect(
      screen.getByRole('button', { name: 'Refresh plugins and reports' }),
    ).toBeDisabled();
    expect(
      screen.getByLabelText(getString('common.loading')),
    ).toBeOnTheScreen();
  });

  it('passes disabled animation settings to the shared title shimmer', () => {
    mockDisableLoadingAnimations = true;
    mockFetch.mockReturnValue(new Promise<Response>(() => {}));
    setIssueSnapshot({ galaxynovels: [[0, issueReport(2991)]] });
    render(<PluginIssuesSection pluginId="galaxynovels" />, {
      wrapper: PaperProvider,
    });

    const shimmerContainer = getTitleSkeleton(2991);
    expect(shimmerContainer.props.accessibilityElementsHidden).toBe(true);
    expect(shimmerContainer.props.importantForAccessibility).toBe(
      'no-hide-descendants',
    );
    expect(StyleSheet.flatten(shimmerContainer.props.style)).toEqual(
      expect.objectContaining({
        borderRadius: 4,
        height: 20,
        maxWidth: '100%',
        width: '80%',
      }),
    );

    let shimmerComponent = shimmerContainer.parent;
    while (shimmerComponent && !('stopAutoRun' in shimmerComponent.props)) {
      shimmerComponent = shimmerComponent.parent;
    }
    expect(shimmerComponent?.props).toEqual(
      expect.objectContaining({
        height: 20,
        stopAutoRun: true,
      }),
    );
    expect(shimmerComponent?.props.shimmerColors).toEqual([
      expect.any(String),
      expect.any(String),
      expect.any(String),
    ]);
    expect(shimmerComponent?.props.shimmerColors[0]).toBe(
      shimmerComponent?.props.shimmerColors[2],
    );
  });

  it('loads issue titles independently and keeps matching accessible links', async () => {
    const pendingResponses = new Map<number, (response: Response) => void>();
    mockFetch.mockImplementation((url: string) => {
      const issueNumber = Number(String(url).split('/').pop());
      let resolveResponse!: (response: Response) => void;
      const promise = new Promise<Response>(resolve => {
        resolveResponse = resolve;
      });
      pendingResponses.set(issueNumber, resolveResponse);
      return promise;
    });
    setIssueSnapshot(fixture);
    const { unmount } = render(
      <PluginIssuesSection pluginId="galaxynovels" />,
      { wrapper: PaperProvider },
    );

    expect(getTitleSkeleton(2133)).toBeOnTheScreen();
    expect(getTitleSkeleton(2667)).toBeOnTheScreen();
    expect(screen.getByText('#2133')).toBeOnTheScreen();
    expect(screen.getByText('#2667')).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Open issue #2133' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Open issue #2667' }),
    ).toBeOnTheScreen();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockFetch).toHaveBeenCalledWith(
      'https://github.com/LNReader/lnreader-plugins/issues/2133',
      { headers: { Accept: 'text/html' } },
    );

    await act(async () => {
      pendingResponses.get(2667)?.({
        ok: true,
        text: async () => issueMetadataHtml[2667],
      } as unknown as Response);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(
        screen.getByRole('link', {
          name: `Open issue #2667: ${issue2667Title}`,
        }),
      ).toBeOnTheScreen();
    });
    expect(queryTitleSkeleton(2667)).toBeNull();
    expect(getTitleSkeleton(2133)).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Open issue #2133' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('link', {
        name: `Open issue #2667: ${issue2667Title}`,
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText(issue2667Title)).toBeOnTheScreen();
    expect(screen.getByText('#2667')).toBeOnTheScreen();
    await act(async () => {
      pendingResponses.get(2133)?.({
        ok: true,
        text: async () => issueMetadataHtml[2133],
      } as unknown as Response);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(
        screen.getByRole('link', {
          name: `Open issue #2133: ${issue2133Title}`,
        }),
      ).toBeOnTheScreen();
    });
    expect(queryTitleSkeleton(2133)).toBeNull();
    expect(
      screen.getAllByRole('link').map(link => link.props.accessibilityLabel),
    ).toEqual([
      `Open issue #2133: ${issue2133Title}`,
      `Open issue #2667: ${issue2667Title}`,
    ]);

    fireEvent.press(
      screen.getByRole('link', {
        name: `Open issue #2667: ${issue2667Title}`,
      }),
    );
    await waitFor(() =>
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://github.com/LNReader/lnreader-plugins/issues/2667',
      ),
    );

    unmount();
    mockFetch.mockClear();
    render(<PluginIssuesSection pluginId="galaxynovels" />, {
      wrapper: PaperProvider,
    });
    expect(
      screen.getByRole('link', {
        name: `Open issue #2133: ${issue2133Title}`,
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('link', {
        name: `Open issue #2667: ${issue2667Title}`,
      }),
    ).toBeOnTheScreen();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows each repository title and opens its source for a shared issue number', async () => {
    const repositoryA = { owner: 'custom-owner', name: 'custom-plugins' };
    const repositoryB = { owner: 'another-owner', name: 'another-plugins' };
    const urlA = 'https://github.com/custom-owner/custom-plugins/issues/42';
    const urlB = 'https://github.com/another-owner/another-plugins/issues/42';
    const pendingResponses = new Map<string, (response: Response) => void>();
    mockFetch.mockImplementation((url: string) => {
      let resolveResponse!: (response: Response) => void;
      const promise = new Promise<Response>(resolve => {
        resolveResponse = resolve;
      });
      pendingResponses.set(url, resolveResponse);
      return promise;
    });
    setIssueSnapshot({
      galaxynovels: [
        [0, issueReport(42, repositoryA), issueReport(42, repositoryB)],
      ],
    });
    render(<PluginIssuesSection pluginId="galaxynovels" />, {
      wrapper: PaperProvider,
    });

    expect(
      screen.getAllByRole('link', { name: 'Open issue #42' }),
    ).toHaveLength(2);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([urlA, urlB]);

    await act(async () => {
      pendingResponses.get(urlB)?.({
        ok: true,
        text: async () => '<head><title>Another source title</title></head>',
      } as unknown as Response);
      await Promise.resolve();
    });
    expect(
      await screen.findByRole('link', {
        name: 'Open issue #42: Another source title',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getAllByRole('link', { name: 'Open issue #42' }),
    ).toHaveLength(1);

    await act(async () => {
      pendingResponses.get(urlA)?.({
        ok: true,
        text: async () => '<head><title>Custom source title</title></head>',
      } as unknown as Response);
      await Promise.resolve();
    });
    expect(
      screen.getByRole('link', { name: 'Open issue #42: Custom source title' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('link', {
        name: 'Open issue #42: Another source title',
      }),
    ).toBeOnTheScreen();

    fireEvent.press(
      screen.getByRole('link', { name: 'Open issue #42: Custom source title' }),
    );
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith(urlA));
    fireEvent.press(
      screen.getByRole('link', {
        name: 'Open issue #42: Another source title',
      }),
    );
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith(urlB));
  });

  it('keeps an issue-number link available when title metadata fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network unavailable'));
    setIssueSnapshot({ galaxynovels: [[0, issueReport(2442)]] });
    render(<PluginIssuesSection pluginId="galaxynovels" />, {
      wrapper: PaperProvider,
    });

    expect(getTitleSkeleton(2442)).toBeOnTheScreen();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queryTitleSkeleton(2442)).toBeNull());
    expect(screen.getByText('#2442')).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Open issue #2442' }),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('link', { name: 'Open issue #2442' }));
    await waitFor(() =>
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://github.com/LNReader/lnreader-plugins/issues/2442',
      ),
    );
    expect(showToast).not.toHaveBeenCalled();
  });
});
