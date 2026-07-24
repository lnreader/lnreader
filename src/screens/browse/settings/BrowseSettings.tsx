import { FlatList, StyleSheet } from 'react-native';
import { Appbar, List, SwitchItem } from '@components';

import {
  useBrowseSettings,
  useLanguagesFilter,
  usePluginActions,
  useTheme,
} from '@hooks/persisted/index';
import { getString } from '@i18n/translations';
import { getLocaleLanguageName, languages } from '@utils/constants/languages';
import { BrowseSettingsScreenProp } from '@navigators/types/index';
import { useBoolean } from '@hooks';
import ConcurrentSearchesModal from '@screens/browse/settings/modals/ConcurrentSearchesModal';

const BrowseSettings = ({ navigation }: BrowseSettingsScreenProp) => {
  const theme = useTheme();
  const { goBack } = navigation;

  const languagesFilter = useLanguagesFilter();
  const { toggleLanguageFilter } = usePluginActions();
  const {
    showMyAnimeList,
    showAniList,
    globalSearchConcurrency,
    setBrowseSettings,
  } = useBrowseSettings();

  const globalSearchConcurrencyModal = useBoolean();

  return (
    <>
      <Appbar
        title={getString('browseSettings')}
        handleGoBack={goBack}
        theme={theme}
      />
      <ConcurrentSearchesModal
        globalSearchConcurrency={globalSearchConcurrency ?? 1}
        modalVisible={globalSearchConcurrencyModal.value}
        hideModal={globalSearchConcurrencyModal.setFalse}
        theme={theme}
      />
      <FlatList
        contentContainerStyle={styles.container}
        ListHeaderComponent={
          <>
            <List.SubHeader theme={theme}>
              {getString('browseScreen.globalSearch')}
            </List.SubHeader>
            <List.Item
              title={getString('browseSettingsScreen.concurrentSearches')}
              description={(globalSearchConcurrency ?? 1).toString()}
              onPress={globalSearchConcurrencyModal.setTrue}
              theme={theme}
            />
            <List.Divider theme={theme} />
            <List.SubHeader theme={theme}>
              {getString('browseScreen.discover')}
            </List.SubHeader>
            <SwitchItem
              label={`${getString('common.show')} AniList`}
              value={showAniList}
              onPress={() => setBrowseSettings({ showAniList: !showAniList })}
              theme={theme}
              style={styles.item}
            />
            <SwitchItem
              label={`${getString('common.show')} MyAnimeList`}
              value={showMyAnimeList}
              onPress={() =>
                setBrowseSettings({ showMyAnimeList: !showMyAnimeList })
              }
              theme={theme}
              style={styles.item}
            />
            <List.Divider theme={theme} />
            <List.SubHeader theme={theme}>
              {getString('browseSettingsScreen.languages')}
            </List.SubHeader>
          </>
        }
        keyExtractor={item => item}
        data={languages}
        renderItem={({ item }) => (
          <SwitchItem
            label={getLocaleLanguageName(item)}
            value={languagesFilter.includes(item)}
            onPress={() => toggleLanguageFilter(item)}
            theme={theme}
            style={styles.item}
          />
        )}
      />
    </>
  );
};

export default BrowseSettings;

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  item: {
    paddingHorizontal: 16,
  },
});
