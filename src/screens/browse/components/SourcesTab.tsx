import { memo, useCallback, useMemo } from 'react';
import { Image, ListItem, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  size,
} from '@expo/ui/jetpack-compose/modifiers';

import {
  AppText,
  Button,
  ComposeList,
  EmptyView,
  IconButtonV2,
  ScreenContent,
  listItemColors,
} from '@components';
import {
  useBrowseSettings,
  useFilteredInstalledPlugins,
  useLastUsedPluginId,
  usePinnedPlugins,
  usePluginActions,
} from '@hooks/persisted';
import { BrowseScreenProps } from '@navigators/types';
import { PluginItem } from '@plugins/types';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import { getLocaleLanguageName } from '@utils/constants/languages';
import ExtensionIcon from '@expo/material-symbols/extension.xml';
import KeepIcon from '@expo/material-symbols/keep.xml';

import DiscoverCard from '../discover/DiscoverCard';
import { buildSourceEntries, SourceEntry } from '../utils/buildBrowseEntries';

interface SourcesTabProps {
  navigation: BrowseScreenProps['navigation'];
  onOpenPlugins: () => void;
  searchText: string;
  theme: ThemeColors;
}

interface SourceRowProps {
  isPinned: boolean;
  onLatestPress: (plugin: PluginItem) => void;
  onPinPress: (plugin: PluginItem) => void;
  onPress: (plugin: PluginItem) => void;
  plugin: PluginItem;
  theme: ThemeColors;
}

const SourceRow = memo(
  ({
    isPinned,
    onLatestPress,
    onPinPress,
    onPress,
    plugin,
    theme,
  }: SourceRowProps) => (
    <ListItem
      colors={listItemColors(theme)}
      modifiers={[fillMaxWidth(), clickable(() => onPress(plugin))]}
    >
      <ListItem.LeadingContent>
        <Image
          source={{ uri: plugin.iconUrl }}
          contentScale="crop"
          modifiers={[size(40, 40), clip(Shapes.RoundedCorner(10))]}
        />
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <AppText variant="bodyLarge" maxLines={1}>
          {plugin.name}
        </AppText>
      </ListItem.HeadlineContent>
      <ListItem.SupportingContent>
        <AppText
          variant="bodySmall"
          color={theme.onSurfaceVariant}
          maxLines={1}
        >
          {getLocaleLanguageName(plugin.lang)}
        </AppText>
      </ListItem.SupportingContent>
      <ListItem.TrailingContent>
        <Row verticalAlignment="center">
          <Button
            mode="text"
            title={getString('browseScreen.latest')}
            onPress={() => onLatestPress(plugin)}
          />
          <IconButtonV2
            name={KeepIcon}
            accessibilityLabel={
              isPinned
                ? getString('browseScreen.unpinSource', { name: plugin.name })
                : getString('browseScreen.pinSource', { name: plugin.name })
            }
            selected={isPinned}
            onPress={() => onPinPress(plugin)}
            theme={theme}
          />
        </Row>
      </ListItem.TrailingContent>
    </ListItem>
  ),
);

export const SourcesTab = memo(
  ({ navigation, onOpenPlugins, searchText, theme }: SourcesTabProps) => {
    const installedPlugins = useFilteredInstalledPlugins();
    const lastUsedPluginId = useLastUsedPluginId();
    const pinnedPlugins = usePinnedPlugins();
    const { setLastUsedPluginId, togglePinPlugin } = usePluginActions();
    const { showMyAnimeList, showAniList } = useBrowseSettings();

    const navigateToSource = useCallback(
      (plugin: PluginItem, showLatestNovels?: boolean) => {
        navigation.navigate('SourceScreen', {
          pluginId: plugin.id,
          pluginName: plugin.name,
          site: plugin.site,
          showLatestNovels,
        });
        setLastUsedPluginId(plugin.id);
      },
      [navigation, setLastUsedPluginId],
    );

    const openSource = useCallback(
      (plugin: PluginItem) => navigateToSource(plugin),
      [navigateToSource],
    );

    const openLatest = useCallback(
      (plugin: PluginItem) => navigateToSource(plugin, true),
      [navigateToSource],
    );

    const togglePin = useCallback(
      (plugin: PluginItem) => {
        togglePinPlugin(plugin.id);
      },
      [togglePinPlugin],
    );

    const entries = useMemo(() => {
      return buildSourceEntries({
        installedPlugins,
        lastUsedPluginId,
        pinnedPluginIds: pinnedPlugins,
        searchText,
        showAniList,
        showMyAnimeList,
      });
    }, [
      installedPlugins,
      lastUsedPluginId,
      pinnedPlugins,
      searchText,
      showAniList,
      showMyAnimeList,
    ]);

    const renderItem = useCallback(
      (item: SourceEntry) => {
        if (item.type === 'header') {
          return (
            <AppText
              variant="titleSmall"
              color={theme.primary}
              modifiers={[padding(16, 16, 16, 4)]}
            >
              {item.title}
            </AppText>
          );
        }

        if (item.type === 'discover') {
          const isAniList = item.tracker === 'AniList';
          return (
            <DiscoverCard
              theme={theme}
              icon={
                isAniList
                  ? require('../../../../assets/anilist.png')
                  : require('../../../../assets/mal.png')
              }
              trackerName={item.tracker}
              onPress={() =>
                navigation.navigate(isAniList ? 'BrowseAL' : 'BrowseMal')
              }
            />
          );
        }

        if (item.type === 'empty') {
          return (
            <EmptyView
              description={getString('browseScreen.noSources')}
              actions={[
                {
                  iconName: ExtensionIcon,
                  onPress: onOpenPlugins,
                  title: getString('browseScreen.plugins'),
                },
              ]}
              theme={theme}
            />
          );
        }

        return (
          <SourceRow
            plugin={item.plugin}
            isPinned={item.isPinned}
            onPress={openSource}
            onLatestPress={openLatest}
            onPinPress={togglePin}
            theme={theme}
          />
        );
      },
      [navigation, onOpenPlugins, openLatest, openSource, theme, togglePin],
    );

    if (!entries.length) {
      return (
        <ScreenContent>
          <EmptyView
            description={getString('browseScreen.noSearchResults')}
            theme={theme}
          />
        </ScreenContent>
      );
    }

    return (
      <ComposeList
        data={entries}
        estimatedItemSize={64}
        keyExtractor={item => item.key}
        contentPadding={{ bottom: 16 }}
        renderItem={renderItem}
      />
    );
  },
);
