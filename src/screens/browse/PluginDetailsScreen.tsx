import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Appbar,
  Button,
  ConfirmationDialog,
  EmptyView,
  SafeAreaView,
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
      <SafeAreaView excludeTop>
        <Appbar
          mode="small"
          title={getString('browseScreen.pluginDetails')}
          handleGoBack={navigation.goBack}
          theme={theme}
        />
        <EmptyView
          icon="(･Д･。"
          description={getString('browseScreen.pluginNotInstalled')}
          theme={theme}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView excludeTop>
      <Appbar
        mode="small"
        title={getString('browseScreen.pluginDetails')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Image
            accessibilityLabel={`${plugin.name} ${getString(
              'browseScreen.pluginIcon',
            )}`}
            accessible
            source={{ uri: plugin.iconUrl }}
            style={[styles.heroIcon, { backgroundColor: theme.surfaceVariant }]}
          />
          <Text style={[styles.pluginName, { color: theme.onSurface }]}>
            {plugin.name}
          </Text>
          <Text style={[styles.pluginId, { color: theme.onSurfaceVariant }]}>
            {plugin.id}
          </Text>
        </View>

        <View style={styles.metadata}>
          <Metadata
            label={getString('aboutScreen.version')}
            value={plugin.version}
            theme={theme}
          />
          <View style={[styles.divider, { backgroundColor: theme.outline }]} />
          <Metadata
            label={getString('browseScreen.language')}
            value={getLocaleLanguageName(plugin.lang)}
            theme={theme}
          />
        </View>

        <View style={styles.actions}>
          <Button
            mode="outlined"
            style={styles.action}
            title={getString('browseScreen.uninstall')}
            onPress={() => setShowUninstallDialog(true)}
          />
          <Button
            mode="contained"
            style={styles.action}
            title={getString('aboutScreen.website')}
            onPress={() =>
              navigation.navigate('WebviewScreen', {
                name: plugin.name,
                url: plugin.site,
                pluginId: plugin.id,
              })
            }
          />
        </View>
        {settingsLoading ? (
          <ActivityIndicator
            accessibilityLabel={getString('common.loading')}
            color={theme.primary}
            style={styles.settingsLoading}
          />
        ) : null}
        {!settingsLoading && settingsEntries.length ? (
          <>
            <View
              style={[
                styles.settingsDivider,
                { backgroundColor: theme.outline },
              ]}
            />
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
      </ScrollView>
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
    </SafeAreaView>
  );
};

interface MetadataProps {
  label: string;
  theme: ReturnType<typeof useTheme>;
  value: string;
}

const Metadata = ({ label, theme, value }: MetadataProps) => (
  <View style={styles.metadataItem}>
    <Text style={[styles.metadataValue, { color: theme.onSurface }]}>
      {value}
    </Text>
    <Text style={[styles.metadataLabel, { color: theme.onSurfaceVariant }]}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  action: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  divider: {
    height: 44,
    opacity: 0.5,
    width: StyleSheet.hairlineWidth,
  },
  hero: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingTop: 8,
  },
  heroIcon: {
    borderRadius: 12,
    height: 112,
    width: 112,
  },
  metadata: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  metadataItem: {
    alignItems: 'center',
    flex: 1,
  },
  metadataLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  metadataValue: {
    fontSize: 16,
  },
  pluginId: {
    fontSize: 14,
    marginTop: 4,
  },
  pluginName: {
    fontSize: 26,
    fontWeight: '600',
    marginTop: 16,
  },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 12,
    marginTop: 28,
    opacity: 0.5,
  },
  settingsLoading: {
    marginTop: 28,
  },
});

export default PluginDetailsScreen;
