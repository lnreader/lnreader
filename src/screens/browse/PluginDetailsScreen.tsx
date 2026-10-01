import { useCallback, useState } from 'react';
import { Column, Image, Row } from '@expo/ui/jetpack-compose';
import {
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
  ConfirmationDialog,
  EmptyView,
  List,
  LoadingMoreIndicator,
} from '@components';
import {
  useInstalledPlugins,
  usePluginActions,
  useTheme,
} from '@hooks/persisted';
import { PluginDetailsScreenProps } from '@navigators/types';
import { getString } from '@i18n/translations';
import { getLocaleLanguageName } from '@utils/constants/languages';
import { showToast } from '@utils/showToast';
import SettingsPage from '@screens/settings/components/SettingsPage';

import { PluginSettingField } from './components/PluginSettingField';
import { usePluginSettings } from './hooks/usePluginSettings';

const PluginDetailsScreen = ({
  navigation,
  route,
}: PluginDetailsScreenProps) => {
  const theme = useTheme();
  const installedPlugins = useInstalledPlugins();
  const { uninstallPlugin } = usePluginActions();
  const [showUninstallDialog, setShowUninstallDialog] = useState(false);
  const plugin = installedPlugins.find(
    item => item.id === route.params.pluginId,
  );
  const {
    changeAndSaveValue,
    changeValue,
    entries: settingsEntries,
    isLoading: settingsLoading,
    saveTextValue,
    values: formValues,
  } = usePluginSettings(route.params.pluginId);

  const uninstall = useCallback(async () => {
    if (!plugin) return;

    try {
      await uninstallPlugin(plugin);
      showToast(
        getString('browseScreen.uninstalledPlugin', { name: plugin.name }),
      );
      navigation.goBack();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }, [navigation, plugin, uninstallPlugin]);

  if (!plugin) {
    return (
      <SettingsPage
        title={getString('browseScreen.pluginDetails')}
        onBack={navigation.goBack}
      >
        <EmptyView
          icon="(･Д･。"
          description={getString('browseScreen.pluginNotInstalled')}
          theme={theme}
        />
      </SettingsPage>
    );
  }

  return (
    <SettingsPage
      title={getString('browseScreen.pluginDetails')}
      onBack={navigation.goBack}
      overlays={
        <ConfirmationDialog
          title={getString('browseScreen.uninstall')}
          confirmLabel={getString('browseScreen.uninstall')}
          visible={showUninstallDialog}
          message={getString('browseScreen.deletePluginMessage', {
            name: plugin.name,
          })}
          onDismiss={() => setShowUninstallDialog(false)}
          onConfirm={uninstall}
        />
      }
    >
      <Column
        horizontalAlignment="center"
        verticalArrangement={{ spacedBy: 4 }}
        modifiers={[fillMaxWidth(), padding(24, 16, 24, 16)]}
      >
        <Image
          contentDescription={`${plugin.name} ${getString(
            'browseScreen.pluginIcon',
          )}`}
          source={{ uri: plugin.iconUrl }}
          contentScale="crop"
          modifiers={[size(88, 88), clip(Shapes.RoundedCorner(24))]}
        />
        <AppText variant="headlineSmall" align="center">
          {plugin.name}
        </AppText>
        <AppText
          variant="bodyMedium"
          align="center"
          color={theme.onSurfaceVariant}
        >
          {plugin.id}
        </AppText>
      </Column>

      <Row
        horizontalArrangement="spaceEvenly"
        modifiers={[fillMaxWidth(), padding(24, 0, 24, 16)]}
      >
        <Metadata
          label={getString('aboutScreen.version')}
          value={plugin.version}
          theme={theme}
        />
        <Metadata
          label={getString('browseScreen.language')}
          value={getLocaleLanguageName(plugin.lang)}
          theme={theme}
        />
      </Row>

      <Row
        horizontalArrangement={{ spacedBy: 12 }}
        modifiers={[fillMaxWidth(), padding(24, 0, 24, 16)]}
      >
        <Button
          mode="outlined"
          modifiers={[weight(1)]}
          title={getString('browseScreen.uninstall')}
          onPress={() => setShowUninstallDialog(true)}
        />
        <Button
          mode="contained"
          modifiers={[weight(1)]}
          title={getString('aboutScreen.website')}
          onPress={() =>
            navigation.navigate('WebviewScreen', {
              name: plugin.name,
              url: plugin.site,
              pluginId: plugin.id,
            })
          }
        />
      </Row>
      {settingsLoading ? <LoadingMoreIndicator theme={theme} /> : null}
      {!settingsLoading && settingsEntries.length ? (
        <>
          <List.Divider theme={theme} />
          {settingsEntries.map(([key, setting]) => (
            <PluginSettingField
              key={key}
              onChange={changeAndSaveValue}
              onChangeText={changeValue}
              onEndTextEditing={saveTextValue}
              setting={setting}
              settingKey={key}
              theme={theme}
              value={formValues[key]}
            />
          ))}
        </>
      ) : null}
    </SettingsPage>
  );
};

interface MetadataProps {
  label: string;
  theme: ReturnType<typeof useTheme>;
  value: string;
}

const Metadata = ({ label, theme, value }: MetadataProps) => (
  <Column horizontalAlignment="center">
    <AppText variant="titleMedium">{value}</AppText>
    <AppText variant="bodySmall" color={theme.onSurfaceVariant}>
      {label}
    </AppText>
  </Column>
);

export default PluginDetailsScreen;
