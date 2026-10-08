import { memo, useCallback, useMemo, useState } from 'react';
import { Image, ListItem, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  weight,
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
import DownloadIcon from '@expo/material-symbols/download.xml';
import PublicIcon from '@expo/material-symbols/public.xml';
import SettingsIcon from '@expo/material-symbols/settings.xml';
import SourceEnvironmentIcon from '@expo/material-symbols/source_environment.xml';
import TuneIcon from '@expo/material-symbols/tune.xml';
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
      <ListItem
        colors={listItemColors(theme)}
        modifiers={
          isInstalled
            ? [fillMaxWidth(), clickable(() => onOpenDetails(plugin))]
            : [fillMaxWidth()]
        }
      >
        <ListItem.LeadingContent>
          <Image
            source={{ uri: plugin.iconUrl }}
            contentScale="crop"
            contentDescription={
              isInstalled
                ? getString('browseScreen.openPluginDetails', {
                    name: plugin.name,
                  })
                : undefined
            }
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
            {`${getLocaleLanguageName(plugin.lang)} · ${plugin.version}`}
          </AppText>
        </ListItem.SupportingContent>
        <ListItem.TrailingContent>
          <Row verticalAlignment="center">
            {status === 'available' ? (
              <IconButtonV2
                name={PublicIcon}
                accessibilityLabel={getString('browseScreen.openWebsite', {
                  name: plugin.name,
                })}
                onPress={() => onOpenWebsite(plugin)}
                theme={theme}
              />
            ) : (
              <IconButtonV2
                name={SettingsIcon}
                accessibilityLabel={getString(
                  'browseScreen.openPluginSettings',
                  {
                    name: plugin.name,
                  },
                )}
                onPress={() => onOpenDetails(plugin)}
                theme={theme}
              />
            )}
            {status !== 'installed' ? (
              <IconButtonV2
                name={DownloadIcon}
                accessibilityLabel={
                  status === 'available'
                    ? getString('browseScreen.installPlugin', {
                        name: plugin.name,
                      })
                    : getString('browseScreen.updatePlugin', {
                        name: plugin.name,
                      })
                }
                disabled={disabled}
                onPress={
                  status === 'available'
                    ? () => onInstall(plugin)
                    : () => onUpdate(plugin)
                }
                theme={theme}
              />
            ) : null}
          </Row>
        </ListItem.TrailingContent>
      </ListItem>
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
      (item: PluginEntry) => {
        if (item.type === 'header') {
          return (
            <Row
              verticalAlignment="center"
              modifiers={[fillMaxWidth(), padding(16, 16, 12, 4)]}
            >
              <AppText
                variant="titleSmall"
                color={theme.primary}
                modifiers={[weight(1)]}
              >
                {item.title}
              </AppText>
              {item.action === 'updateAll' ? (
                <Button
                  mode="contained-tonal"
                  onPress={updateAll}
                  title={getString('browseScreen.updateAll')}
                />
              ) : null}
            </Row>
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

    if (!entries.length) {
      return (
        <ScreenContent>
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
                      iconName: SourceEnvironmentIcon,
                      onPress: openRepositories,
                      title: getString('browseScreen.repositories'),
                    },
                    {
                      iconName: TuneIcon,
                      onPress: openBrowseSettings,
                      title: getString('browseSettings'),
                    },
                  ]
            }
            theme={theme}
          />
        </ScreenContent>
      );
    }

    return (
      <ComposeList
        data={entries}
        extraData={pendingPluginIds}
        estimatedItemSize={64}
        keyExtractor={item => item.key}
        contentPadding={{ bottom: 16 }}
        refreshing={refreshing}
        onRefresh={refresh}
        renderItem={renderItem}
      />
    );
  },
);
