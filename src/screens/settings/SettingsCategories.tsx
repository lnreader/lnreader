import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Column, ListItem, Surface } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  verticalScroll,
} from '@expo/ui/jetpack-compose/modifiers';
import type { NavigationState } from '@react-navigation/native';

import { useTheme } from '@hooks/persisted/useTheme';
import { getString } from '@i18n/translations';
import type { SettingsStackParamList } from '@navigators/types';
import { useRailLayout } from '@navigators/destinations';
import BackupIcon from '@expo/material-symbols/backup.xml';
import BuildIcon from '@expo/material-symbols/build.xml';
import CategoryIcon from '@expo/material-symbols/category.xml';
import ChromeReaderModeIcon from '@expo/material-symbols/chrome_reader_mode.xml';
import CodeIcon from '@expo/material-symbols/code.xml';
import InfoIcon from '@expo/material-symbols/info.xml';
import PaletteIcon from '@expo/material-symbols/palette.xml';
import ShelvesIcon from '@expo/material-symbols/shelves.xml';
import SourceEnvironmentIcon from '@expo/material-symbols/source_environment.xml';
import SyncIcon from '@expo/material-symbols/sync.xml';
import TuneIcon from '@expo/material-symbols/tune.xml';
import {
  AppHost,
  AppIcon,
  AppText,
  InsetOverrideProvider,
  Appbar,
  listItemColors,
  useIsTopLevelScreen,
  useScreenInsets,
  type IconSource,
} from '@components';
import { SettingsPaneProvider } from '@screens/settings/components/SettingsPage';
import { useWindowLayout } from '@hooks/common/useWindowLayout';

export type SettingsRoute = Exclude<
  keyof SettingsStackParamList,
  'Settings' | 'CodeSnippets'
>;

interface SettingsCategory {
  route: SettingsRoute;
  icon: IconSource;
  title: () => string;
}

export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  {
    route: 'GeneralSettings',
    icon: TuneIcon,
    title: () => getString('generalSettings'),
  },
  {
    route: 'AppearanceSettings',
    icon: PaletteIcon,
    title: () => getString('appearance'),
  },
  {
    route: 'LibrarySettings',
    icon: ShelvesIcon,
    title: () => getString('library'),
  },
  {
    route: 'ReaderSettings',
    icon: ChromeReaderModeIcon,
    title: () => getString('readerSettings.title'),
  },
  {
    route: 'RespositorySettings',
    icon: SourceEnvironmentIcon,
    title: () => 'Repositories',
  },
  {
    route: 'CustomCode',
    icon: CodeIcon,
    title: () => 'Custom Code',
  },
  {
    route: 'TrackerSettings',
    icon: SyncIcon,
    title: () => getString('tracking'),
  },
  {
    route: 'BackupSettings',
    icon: BackupIcon,
    title: () => getString('common.backup'),
  },
  {
    route: 'AdvancedSettings',
    icon: BuildIcon,
    title: () => getString('advancedSettings'),
  },
  {
    route: 'GenreTaxonomy',
    icon: CategoryIcon,
    title: () => getString('genreStats.taxonomyTitle'),
  },
];

const CategoryRow = ({
  icon,
  title,
  active,
  onPress,
}: {
  icon: IconSource;
  title: string;
  active: boolean;
  onPress: () => void;
}) => {
  const theme = useTheme();
  return (
    <ListItem
      colors={{
        ...listItemColors(theme),
        containerColor: active ? theme.secondaryContainer : 'transparent',
        leadingContentColor: active
          ? theme.onSecondaryContainer
          : theme.onSurfaceVariant,
      }}
      modifiers={[
        fillMaxWidth(),
        clip(Shapes.RoundedCorner(28)),
        clickable(onPress),
      ]}
    >
      <ListItem.LeadingContent>
        <AppIcon
          source={icon}
          tint={active ? theme.onSecondaryContainer : theme.primary}
        />
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <AppText
          variant="bodyLarge"
          color={active ? theme.onSecondaryContainer : theme.onSurface}
        >
          {title}
        </AppText>
      </ListItem.HeadlineContent>
    </ListItem>
  );
};

export const SettingsCategoryList = ({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (route: SettingsRoute) => void;
}) => {
  // With the More screens in the rail, About is listed here.
  const { extended } = useRailLayout();
  return (
    <Column modifiers={[fillMaxWidth(), padding(12, 0, 12, 0)]}>
      {SETTINGS_CATEGORIES.map(category => (
        <CategoryRow
          key={category.route}
          icon={category.icon}
          title={category.title()}
          active={category.route === selected}
          onPress={() => onSelect(category.route)}
        />
      ))}
      {extended ? (
        <CategoryRow
          icon={InfoIcon}
          title={getString('common.about')}
          active={selected === 'About'}
          onPress={() => onSelect('About')}
        />
      ) : null}
    </Column>
  );
};

const PANE_WIDTH = 360;

export const SettingsListDetailLayout = ({
  state,
  children,
  onSelect,
  onBack,
}: {
  state: NavigationState;
  children: ReactNode;
  onSelect: (route: SettingsRoute) => void;
  onBack: () => void;
}) => {
  const theme = useTheme();
  const layout = useWindowLayout();
  const { top, left, bottom } = useScreenInsets();
  // A rail destination needs no way back; otherwise the pane keeps a header
  // with the back arrow (the pages beside it show their icon instead).
  const topLevel = useIsTopLevelScreen();
  if (!layout.isExpanded) {
    return <>{children}</>;
  }
  const current = state.routes[state.index]?.name;
  const pane = { offset: PANE_WIDTH + left };
  return (
    <View style={styles.row}>
      <AppHost style={{ width: PANE_WIDTH + left }}>
        <Surface
          color={theme.background}
          contentColor={theme.onSurface}
          modifiers={[fillMaxSize()]}
        >
          <Column
            modifiers={[
              fillMaxSize(),
              verticalScroll(),
              padding(0, topLevel ? top + 8 : 0, 0, bottom + 16),
            ]}
          >
            {topLevel ? null : (
              <Appbar
                title={getString('common.settings')}
                handleGoBack={onBack}
                containerColor={theme.background}
                theme={theme}
              />
            )}
            <Column
              modifiers={[
                fillMaxWidth(),
                padding(left, topLevel ? 0 : 8, 0, 0),
              ]}
            >
              <SettingsCategoryList selected={current} onSelect={onSelect} />
            </Column>
          </Column>
        </Surface>
      </AppHost>
      <View style={styles.detail}>
        <InsetOverrideProvider value={{ left: 0 }}>
          <SettingsPaneProvider value={pane}>{children}</SettingsPaneProvider>
        </InsetOverrideProvider>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  detail: { flex: 1 },
});
