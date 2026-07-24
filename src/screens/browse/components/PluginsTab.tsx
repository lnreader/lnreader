import { memo, useCallback, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  LegendList,
  LegendListRenderItemProps,
} from '@legendapp/list/react-native';

import { Button, EmptyView, IconButtonV2 } from '@components';
import {
  useFilteredAvailablePlugins,
  useInstalledPlugins,
  usePluginActions,
} from '@hooks/persisted';
import { BrowseScreenProps } from '@navigators/types';
import { PluginItem } from '@plugins/types';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import { getLocaleLanguageName } from '@utils/constants/languages';
import { showToast } from '@utils/showToast';
import {
  buildPluginEntries,
  PluginEntry,
  PluginStatus,
} from '../utils/buildBrowseEntries';

interface PluginsTabProps {
  navigation: BrowseScreenProps['navigation'];
  searchText: string;
  theme: ThemeColors;
}

interface PluginRowProps {
  disabled: boolean;
  onInstall: (plugin: PluginItem) => void;
  onOpenDetails: (plugin: PluginItem) => void;
  onOpenWebsite: (plugin: PluginItem) => void;
  onUpdate: (plugin: PluginItem) => void;
  plugin: PluginItem;
  status: PluginStatus;
  theme: ThemeColors;
}

const PluginRow = memo(
  ({
    disabled,
    onInstall,
    onOpenDetails,
    onOpenWebsite,
    onUpdate,
    plugin,
    status,
    theme,
  }: PluginRowProps) => {
    const isInstalled = status !== 'available';

    return (
      <View style={styles.pluginRow}>
        <Pressable
          accessibilityLabel={
            isInstalled
              ? getString('browseScreen.openPluginDetails', {
                  name: plugin.name,
                })
              : undefined
          }
          accessibilityRole={isInstalled ? 'button' : undefined}
          disabled={!isInstalled}
          style={styles.pluginRowAction}
          android_ripple={
            isInstalled ? { color: theme.rippleColor } : undefined
          }
          onPress={() => onOpenDetails(plugin)}
        />
        <View pointerEvents="none" style={styles.pluginMainContent}>
          <Image
            source={{ uri: plugin.iconUrl }}
            style={[styles.icon, { backgroundColor: theme.surfaceVariant }]}
          />
          <View style={styles.details}>
            <Text
              numberOfLines={1}
              style={[styles.name, { color: theme.onSurface }]}
            >
              {plugin.name}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.description, { color: theme.onSurfaceVariant }]}
            >
              {`${getLocaleLanguageName(plugin.lang)} · ${plugin.version}`}
            </Text>
          </View>
        </View>
        {status === 'available' ? (
          <IconButtonV2
            accessibilityLabel={getString('browseScreen.openWebsite', {
              name: plugin.name,
            })}
            name="earth"
            color={theme.onSurfaceVariant}
            onPress={() => onOpenWebsite(plugin)}
            theme={theme}
          />
        ) : (
          <IconButtonV2
            accessibilityLabel={getString('browseScreen.openPluginSettings', {
              name: plugin.name,
            })}
            name="cog-outline"
            color={theme.onSurfaceVariant}
            onPress={() => onOpenDetails(plugin)}
            theme={theme}
          />
        )}
        {status !== 'installed' ? (
          <IconButtonV2
            accessibilityLabel={
              status === 'available'
                ? getString('browseScreen.installPlugin', {
                    name: plugin.name,
                  })
                : getString('browseScreen.updatePlugin', {
                    name: plugin.name,
                  })
            }
            name="download-outline"
            color={theme.onSurface}
            disabled={disabled}
            onPress={
              status === 'available'
                ? () => onInstall(plugin)
                : () => onUpdate(plugin)
            }
            theme={theme}
          />
        ) : null}
      </View>
    );
  },
);

export const PluginsTab = memo(
  ({ navigation, searchText, theme }: PluginsTabProps) => {
    const installedPlugins = useInstalledPlugins();
    const availablePlugins = useFilteredAvailablePlugins();
    const { installPlugin, refreshPlugins, updatePlugin } = usePluginActions();
    const [refreshing, setRefreshing] = useState(false);
    const [pendingPluginIds, setPendingPluginIds] = useState<Set<string>>(
      () => new Set(),
    );

    const updatePendingState = useCallback(
      (pluginId: string, pending: boolean) => {
        setPendingPluginIds(current => {
          const updated = new Set(current);
          if (pending) {
            updated.add(pluginId);
          } else {
            updated.delete(pluginId);
          }
          return updated;
        });
      },
      [],
    );

    const install = useCallback(
      async (plugin: PluginItem) => {
        updatePendingState(plugin.id, true);
        try {
          await installPlugin(plugin);
          showToast(
            getString('browseScreen.installedPlugin', { name: plugin.name }),
          );
        } catch (error) {
          showToast(error instanceof Error ? error.message : String(error));
        } finally {
          updatePendingState(plugin.id, false);
        }
      },
      [installPlugin, updatePendingState],
    );

    const update = useCallback(
      async (plugin: PluginItem) => {
        updatePendingState(plugin.id, true);
        try {
          const version = await updatePlugin(plugin);
          showToast(getString('browseScreen.updatedTo', { version }));
        } catch (error) {
          showToast(error instanceof Error ? error.message : String(error));
        } finally {
          updatePendingState(plugin.id, false);
        }
      },
      [updatePendingState, updatePlugin],
    );

    const pluginsWithUpdates = useMemo(
      () => installedPlugins.filter(plugin => plugin.hasUpdate),
      [installedPlugins],
    );

    const updateAll = useCallback(async () => {
      await Promise.allSettled(pluginsWithUpdates.map(update));
    }, [pluginsWithUpdates, update]);

    const openDetails = useCallback(
      (plugin: PluginItem) =>
        navigation.navigate('PluginDetails', { pluginId: plugin.id }),
      [navigation],
    );

    const openWebsite = useCallback(
      (plugin: PluginItem) =>
        navigation.navigate('WebviewScreen', {
          name: plugin.name,
          url: plugin.site,
          pluginId: plugin.id,
        }),
      [navigation],
    );

    const entries = useMemo(
      () =>
        buildPluginEntries({
          availablePlugins,
          installedPlugins,
          searchText,
        }),
      [availablePlugins, installedPlugins, searchText],
    );

    const openRepositories = useCallback(
      () =>
        navigation.navigate('MoreStack', {
          screen: 'SettingsStack',
          params: { screen: 'RespositorySettings' },
        }),
      [navigation],
    );

    const openBrowseSettings = useCallback(
      () => navigation.navigate('BrowseSettings'),
      [navigation],
    );

    const renderItem = useCallback(
      ({ item }: LegendListRenderItemProps<PluginEntry>) => {
        if (item.type === 'header') {
          return (
            <View
              style={[
                styles.headerRow,
                item.action === 'updateAll' && styles.updateHeaderRow,
              ]}
            >
              <Text
                style={[
                  styles.sectionHeader,
                  { color: theme.onSurfaceVariant },
                ]}
              >
                {item.title}
              </Text>
              {item.action === 'updateAll' ? (
                <Button
                  compact
                  contentStyle={styles.updateAllButtonContent}
                  mode="contained-tonal"
                  onPress={updateAll}
                  style={styles.updateAllButton}
                  title={getString('browseScreen.updateAll')}
                />
              ) : null}
            </View>
          );
        }

        return (
          <PluginRow
            disabled={pendingPluginIds.has(item.plugin.id)}
            onInstall={install}
            onOpenDetails={openDetails}
            onOpenWebsite={openWebsite}
            onUpdate={update}
            plugin={item.plugin}
            status={item.status}
            theme={theme}
          />
        );
      },
      [
        install,
        openDetails,
        openWebsite,
        pendingPluginIds,
        theme,
        update,
        updateAll,
      ],
    );

    const refresh = useCallback(async () => {
      setRefreshing(true);
      try {
        await refreshPlugins();
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error));
      } finally {
        setRefreshing(false);
      }
    }, [refreshPlugins]);

    return (
      <LegendList
        data={entries}
        estimatedItemSize={64}
        getItemType={item => item.type}
        keyExtractor={item => item.key}
        ListEmptyComponent={
          <EmptyView
            description={
              searchText.trim()
                ? getString('browseScreen.noSearchResults')
                : getString('browseScreen.noPlugins')
            }
            actions={
              searchText.trim()
                ? undefined
                : [
                    {
                      iconName: 'source-repository',
                      onPress: openRepositories,
                      title: getString('browseScreen.repositories'),
                    },
                    {
                      iconName: 'tune',
                      onPress: openBrowseSettings,
                      title: getString('browseSettings'),
                    },
                  ]
            }
            theme={theme}
          />
        }
        contentContainerStyle={!entries.length ? styles.emptyList : undefined}
        recycleItems
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[theme.onPrimary]}
            progressBackgroundColor={theme.primary}
          />
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    );
  },
);

const styles = StyleSheet.create({
  description: {
    fontSize: 13,
    lineHeight: 20,
  },
  emptyList: {
    flexGrow: 1,
  },
  details: {
    flex: 1,
    marginStart: 16,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  icon: {
    borderRadius: 4,
    height: 44,
    width: 44,
  },
  name: {
    fontSize: 16,
    lineHeight: 22,
  },
  pluginRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 64,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'relative',
  },
  pluginMainContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  pluginRowAction: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sectionHeader: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 10,
  },
  updateAllButton: {
    borderRadius: 24,
  },
  updateAllButtonContent: {
    minHeight: 40,
    paddingHorizontal: 8,
  },
  updateHeaderRow: {
    minHeight: 64,
    paddingVertical: 8,
  },
});
