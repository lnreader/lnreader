import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Appbar, List, SafeAreaView } from '@components';
import { useTheme } from '@hooks/persisted';
import { useTTS } from '../../tts/hooks';
import { EngineType } from '../../tts/engines/TTSEngine';

import { getString } from '@strings/translations';
import { SettingsScreenProps } from '@navigators/types';

const SettingsScreen = ({ navigation }: SettingsScreenProps) => {
  const theme = useTheme();
  const { currentEngine, currentSpeed, currentVoice, setEngine, setSpeed } =
    useTTS();

  const isOfflineEngine = currentEngine === EngineType.OFFLINE;

  const handleEngineToggle = async () => {
    try {
      await setEngine(isOfflineEngine ? EngineType.NATIVE : EngineType.OFFLINE);
    } catch (error) {
      console.error('Failed to switch engine:', error);
    }
  };

  const handleSpeedPress = () => {
    // Cycle through speed options: 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const currentIndex = speeds.findIndex(
      s => Math.abs(s - currentSpeed) < 0.01,
    );
    const nextIndex = (currentIndex + 1) % speeds.length;
    setSpeed(speeds[nextIndex]);
  };

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
        {/* TTS Settings Section */}
        <List.Section>
          <List.SubHeader theme={theme}>Text-to-Speech</List.SubHeader>
          <List.Item
            title="Voice"
            icon="account-voice"
            description={currentVoice?.name || 'Select a voice'}
            onPress={() =>
              navigation.navigate('SettingsStack', {
                screen: 'VoiceSelection',
              })
            }
            theme={theme}
          />
          <List.Item
            title="Engine"
            description={isOfflineEngine ? 'Offline (Piper)' : 'Native'}
            icon="engine"
            right={isOfflineEngine ? 'toggle-switch' : 'toggle-switch-off'}
            onPress={handleEngineToggle}
            theme={theme}
          />
          <List.Item
            title="Speed"
            description={`${currentSpeed.toFixed(1)}x`}
            icon="speedometer"
            onPress={handleSpeedPress}
            theme={theme}
          />
        </List.Section>
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
