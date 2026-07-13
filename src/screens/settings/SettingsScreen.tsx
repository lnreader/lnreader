import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Appbar, List, SafeAreaView } from '@components';
import { useTheme } from '@hooks/persisted';

import { getString } from '@strings/translations';
import { SettingsScreenProps } from '@navigators/types';

const SettingsScreen = ({ navigation }: SettingsScreenProps) => {
  const theme = useTheme();

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('common.settings')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <ScrollView style={[{ backgroundColor: theme.background }, styles.flex]}>
        <List.Item
          title={getString('generalSettings')}
          icon="tune"
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'GeneralSettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title={getString('appearance')}
          icon="palette-outline"
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'AppearanceSettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title={getString('readerSettings.title')}
          icon="book-open-outline"
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'ReaderSettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title="Repositories"
          icon="github"
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'RespositorySettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title="Custom Code"
          icon="code-braces"
          onPress={() => navigation.navigate('CustomCode')}
          theme={theme}
        />
        <List.Item
          title={getString('tracking')}
          icon="sync"
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'TrackerSettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title={getString('common.backup')}
          icon="cloud-upload-outline"
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'BackupSettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title={getString('advancedSettings')}
          icon="code-tags"
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'AdvancedSettings',
            })
          }
          theme={theme}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
