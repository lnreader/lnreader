import { padding } from '@expo/ui/jetpack-compose/modifiers';

import { useTheme } from '@hooks/persisted';
import ListView from '../../components/ListView';
import { Appbar, AppText, ComposeList, Screen } from '@components';
import { SourceNovelsScreenProps } from '@navigators/types';
import { NovelInfo } from '@database/types';
import { getString } from '@i18n/translations';
import { useLibraryContext } from '@components/Context/LibraryContext';

const SourceNovels = ({ navigation, route }: SourceNovelsScreenProps) => {
  const pluginId = route.params.pluginId;
  const theme = useTheme();
  const { library } = useLibraryContext();

  const sourceNovels = library.filter(novel => novel.pluginId === pluginId);

  const renderItem = (item: NovelInfo) => (
    <ListView
      item={item}
      onPress={() =>
        navigation.navigate('MigrateNovel', {
          novel: item,
        })
      }
      theme={theme}
    />
  );

  return (
    <Screen
      topBar={
        <Appbar
          title={getString('browseScreen.selectNovel')}
          handleGoBack={navigation.goBack}
          theme={theme}
        />
      }
      list={
        sourceNovels.length ? (
          <ComposeList
            data={sourceNovels}
            keyExtractor={item => 'migrateFrom' + item.id}
            renderItem={renderItem}
          />
        ) : undefined
      }
    >
      {sourceNovels.length ? null : (
        <AppText
          variant="bodyMedium"
          color={theme.onSurfaceVariant}
          align="center"
          modifiers={[padding(20, 20, 20, 20)]}
        >
          {getString('browseScreen.noSource')}
        </AppText>
      )}
    </Screen>
  );
};

export default SourceNovels;
