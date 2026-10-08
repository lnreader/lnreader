import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { padding } from '@expo/ui/jetpack-compose/modifiers';

import MigrationSourceItem from './MigrationSourceItem';

import { useFilteredInstalledPlugins, useTheme } from '@hooks/persisted';
import { useWindowLayout } from '@hooks/common/useWindowLayout';
import { useLibraryNovels } from '@screens/library/hooks/useLibrary';
import ListView from '../../../components/ListView';
import { Appbar, AppText, ComposeList, Screen } from '@components';
import { MigrationScreenProps } from '@navigators/types';
import { PluginItem } from '@plugins/types';
import { getString } from '@i18n/translations';

const SOURCE_PANE_WIDTH = 360;

const Migration = ({ navigation }: MigrationScreenProps) => {
  const theme = useTheme();
  const layout = useWindowLayout();

  const { library } = useLibraryNovels();
  const filteredInstalledPlugins = useFilteredInstalledPlugins();

  const novelsPerSource = (pluginId: string) =>
    library.filter(novel => novel.pluginId === pluginId).length;

  const plugins = filteredInstalledPlugins.filter(
    plugin => library.find(novel => novel.pluginId === plugin.id) !== undefined,
  );

  // Wide windows list the chosen source's novels beside the sources.
  const twoPane = !layout.isCompact;
  const [selectedId, setSelectedId] = useState<string>();
  const selected = twoPane ? selectedId ?? plugins[0]?.id : undefined;

  const renderItem = (item: PluginItem) => (
    <MigrationSourceItem
      item={item}
      theme={theme}
      noOfNovels={novelsPerSource(item.id)}
      selected={item.id === selected}
      onPress={() =>
        twoPane
          ? setSelectedId(item.id)
          : navigation.navigate('SourceNovels', { pluginId: item.id })
      }
    />
  );

  const ListHeaderComponent = (
    <AppText
      variant="labelLarge"
      color={theme.onSurfaceVariant}
      modifiers={[padding(20, 20, 20, 10)]}
    >
      {getString('browseScreen.migration.selectSourceDesc').toUpperCase()}
    </AppText>
  );

  const sources = (
    <ComposeList
      data={plugins}
      contentPadding={{ bottom: 48 }}
      keyExtractor={item => item.id}
      extraData={selected}
      renderItem={renderItem}
      header={ListHeaderComponent}
    />
  );

  return (
    <Screen
      topBar={
        <Appbar
          title={getString('browseScreen.migration.selectSource')}
          handleGoBack={navigation.goBack}
          theme={theme}
        />
      }
      list={
        selected ? (
          <View style={styles.panes}>
            <View style={styles.sources}>{sources}</View>
            <View
              style={[
                styles.novels,
                { backgroundColor: theme.surfaceContainerLow },
              ]}
            >
              <ComposeList
                data={library.filter(novel => novel.pluginId === selected)}
                keyExtractor={item => 'migrateFrom' + item.id}
                renderItem={item => (
                  <ListView
                    item={item}
                    onPress={() =>
                      navigation.navigate('MigrateNovel', { novel: item })
                    }
                    theme={theme}
                  />
                )}
              />
            </View>
          </View>
        ) : (
          sources
        )
      }
    />
  );
};

export default Migration;

const styles = StyleSheet.create({
  panes: { flex: 1, flexDirection: 'row' },
  sources: { width: SOURCE_PANE_WIDTH },
  novels: { flex: 1, borderTopLeftRadius: 28, overflow: 'hidden' },
});
