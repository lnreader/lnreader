import React, { useCallback, useMemo, useState, memo } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePlugins } from '@hooks/persisted';
import { PluginItem } from '@plugins/types';
import { coverPlaceholderColor } from '@theme/colors';
import { ThemeColors } from '@theme/types';
import { getString } from '@strings/translations';
import { MoreStackScreenProps } from '@navigators/types';
import { EmptyView, IconButtonV2 } from '@components';
import { showToast } from '@utils/showToast';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { getLocaleLanguageName } from '@utils/constants/languages';
import { LegendList, LegendListRenderItemProps } from '@legendapp/list';
interface AvailableTabProps {
  searchText: string;
  theme: ThemeColors;
}
interface AvailablePluginCardProps {
  plugin: PluginItem & { header: boolean };
  theme: ThemeColors;
  installPlugin: (plugin: PluginItem) => Promise<void>;
}

const AvailablePluginCard = ({
  plugin,
  theme,
  installPlugin,
}: AvailablePluginCardProps) => {
  const ratio = useSharedValue(1);
  const imageStyles = useAnimatedStyle(() => ({
    height: ratio.value * 40,
  }));
  const viewStyles = useAnimatedStyle(() => ({
    height: ratio.value * 64,
    paddingVertical: ratio.value * 12,
  }));
  const textStyles = useAnimatedStyle(() => ({
    lineHeight: ratio.value * 20,
  }));

  return (
    <View>
      {plugin.header ? (
        <Text style={[styles.listHeader, { color: theme.onSurfaceVariant }]}>
          {getLocaleLanguageName(plugin.lang)}
        </Text>
      ) : null}
      <Animated.View
        style={[
          styles.container,
          { backgroundColor: theme.surface },
          viewStyles,
        ]}
      >
        <Animated.View style={styles.row}>
          <Animated.Image
            source={{ uri: plugin.iconUrl }}
            style={[
              styles.icon,
              imageStyles,
              { backgroundColor: theme.surface },
            ]}
          />
          <Animated.View style={styles.details}>
            <Animated.Text
              numberOfLines={1}
              style={[
                {
                  color: theme.onSurface,
                },
                styles.name,
                textStyles,
              ]}
            >
              {plugin.name}
            </Animated.Text>
            <Animated.Text
              numberOfLines={1}
              style={[
                { color: theme.onSurfaceVariant },
                styles.addition,
                textStyles,
              ]}
            >
              {`${getLocaleLanguageName(plugin.lang)} - ${plugin.version}`}
            </Animated.Text>
          </Animated.View>
        </Animated.View>
        <IconButtonV2
          name="download-outline"
          color={theme.primary}
          onPress={() => {
            ratio.value = withTiming(0, { duration: 500 });
            installPlugin(plugin)
              .then(() => {
                showToast(
                  getString('browseScreen.installedPlugin', {
                    name: plugin.name,
                  }),
                );
              })
              .catch((error: Error) => {
                showToast(error.message);
                ratio.value = 1;
              });
          }}
          size={22}
          theme={theme}
        />
      </Animated.View>
    </View>
  );
};

export const AvailableTab = memo(({ searchText, theme }: AvailableTabProps) => {
  const navigation = useNavigation<MoreStackScreenProps['navigation']>();

  const [refreshing, setRefreshing] = useState(false);
  const { filteredAvailablePlugins, refreshPlugins, installPlugin } =
    usePlugins();

  const searchedPlugins = useMemo(() => {
    let res = filteredAvailablePlugins;
    if (searchText) {
      const lowerCaseSearchText = searchText.toLocaleLowerCase();
      res = filteredAvailablePlugins.filter(
        plg =>
          plg.name.toLocaleLowerCase().includes(lowerCaseSearchText) ||
          plg.id.includes(lowerCaseSearchText),
      );
    }

    return res
      .sort((a, b) => a.lang.localeCompare(b.lang))
      .map((plg, i) => {
        return {
          ...plg,
          header: i === 0 ? true : plg.lang !== res[i - 1].lang,
        };
      });
  }, [searchText, filteredAvailablePlugins]);

  const renderItem = useCallback(
    ({ item }: LegendListRenderItemProps<PluginItem & { header: boolean }>) => {
      return (
        <AvailablePluginCard
          plugin={item}
          theme={theme}
          installPlugin={installPlugin}
        />
      );
    },
    [theme, installPlugin],
  );

  return (
    <LegendList
      estimatedItemSize={64}
      data={searchedPlugins}
      recycleItems
      extraData={theme}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      keyExtractor={item => item.id + '_available'}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            refreshPlugins()
              .finally(() => setRefreshing(false))
              .catch(e => {
                showToast(e);
              });
          }}
          colors={[theme.onPrimary]}
          progressBackgroundColor={theme.primary}
        />
      }
      ListEmptyComponent={
        !filteredAvailablePlugins.length ? (
          <View style={styles.margintTop100}>
            <EmptyView
              icon="(･Д･。"
              description=" No repositories yet. Add your first plugin repository to get
                started."
              actions={[
                {
                  iconName: 'cog-outline',
                  title: 'Add Repository',
                  onPress: () =>
                    navigation.navigate('MoreStack', {
                      screen: 'SettingsStack',
                      params: {
                        screen: 'RespositorySettings',
                      },
                    }),
                },
              ]}
              theme={theme}
            />
          </View>
        ) : (
          <View style={styles.margintTop100}>
            <EmptyView
              icon="(･Д･。"
              description="No plugins available for this search term"
              theme={theme}
            />
          </View>
        )
      }
    />
  );
});

const styles = StyleSheet.create({
  margintTop100: { marginTop: 100 },
  addition: {
    fontSize: 12,
    lineHeight: 20,
  },
  buttonGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  details: {
    marginLeft: 16,
  },
  icon: {
    backgroundColor: coverPlaceholderColor,
    borderRadius: 4,
    height: 40,
    width: 40,
  },
  listHeader: {
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  name: {
    fontWeight: '500',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
  },
  center: { alignItems: 'center' },
  flex: { flex: 1 },
});
