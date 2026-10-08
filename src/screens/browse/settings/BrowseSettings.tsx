import { FlowRow } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { Chip, SwitchItem, List } from '@components';

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
import SettingsPage from '@screens/settings/components/SettingsPage';

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
    <SettingsPage
      title={getString('browseSettings')}
      onBack={goBack}
      overlays={
        <ConcurrentSearchesModal
          globalSearchConcurrency={globalSearchConcurrency ?? 1}
          modalVisible={globalSearchConcurrencyModal.value}
          hideModal={globalSearchConcurrencyModal.setFalse}
          theme={theme}
        />
      }
    >
      <List.Section>
        <List.SubHeader theme={theme}>
          {getString('browseScreen.globalSearch')}
        </List.SubHeader>
        <List.Item
          title={getString('browseSettingsScreen.concurrentSearches')}
          description={(globalSearchConcurrency ?? 1).toString()}
          onPress={globalSearchConcurrencyModal.setTrue}
          theme={theme}
        />
      </List.Section>
      <List.Divider theme={theme} />
      <List.Section>
        <List.SubHeader theme={theme}>
          {getString('browseScreen.discover')}
        </List.SubHeader>
        <SwitchItem
          label={`${getString('common.show')} AniList`}
          value={showAniList}
          onPress={() => setBrowseSettings({ showAniList: !showAniList })}
          theme={theme}
        />
        <SwitchItem
          label={`${getString('common.show')} MyAnimeList`}
          value={showMyAnimeList}
          onPress={() =>
            setBrowseSettings({ showMyAnimeList: !showMyAnimeList })
          }
          theme={theme}
        />
      </List.Section>
      <List.Divider theme={theme} />
      <List.Section>
        <List.SubHeader theme={theme}>
          {getString('browseSettingsScreen.languages')}
        </List.SubHeader>
        <FlowRow
          horizontalArrangement={{ spacedBy: 8 }}
          verticalArrangement={{ spacedBy: 8 }}
          modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}
        >
          {languages.map(item => (
            <Chip
              key={item}
              kind="filter"
              label={getLocaleLanguageName(item)}
              selected={languagesFilter.includes(item)}
              onPress={() => toggleLanguageFilter(item)}
              theme={theme}
            />
          ))}
        </FlowRow>
      </List.Section>
    </SettingsPage>
  );
};

export default BrowseSettings;
