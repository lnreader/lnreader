import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { Appbar, List, SafeAreaView } from '@components';
import { useTheme } from '@hooks/persisted';
import { useTTS } from '../../tts/hooks';
import { VoiceSelectionScreenProps } from '@navigators/types';

interface VoiceItem {
  voiceId: string;
  name: string;
  language: string;
  gender: string;
  isDownloaded: boolean;
}

const VoiceSelectionScreen = ({ navigation }: VoiceSelectionScreenProps) => {
  const theme = useTheme();
  const {
    isInitialized,
    currentVoice,
    setVoice,
    downloadVoice,
    getAvailableVoices,
    getDownloadedVoices,
  } = useTTS();

  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load voices and their download status
  const loadVoices = useCallback(async () => {
    if (!isInitialized) return;

    setIsLoading(true);
    try {
      const availableVoices = getAvailableVoices();
      const downloadedVoices = await getDownloadedVoices();
      const downloadedIds = new Set(downloadedVoices.map(v => v.voiceId));

      const voiceItems: VoiceItem[] = availableVoices.map(voice => ({
        voiceId: voice.voiceId,
        name: voice.name,
        language: voice.language,
        gender: voice.gender,
        isDownloaded: downloadedIds.has(voice.voiceId),
      }));

      setVoices(voiceItems);
    } catch (error) {
      console.error('Failed to load voices:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, getAvailableVoices, getDownloadedVoices]);

  useEffect(() => {
    loadVoices();
  }, [loadVoices]);

  const handleVoiceSelect = useCallback(
    async (voiceItem: VoiceItem) => {
      if (!voiceItem.isDownloaded) {
        // Start download if not downloaded
        setDownloadingId(voiceItem.voiceId);
        setDownloadProgress(0);

        try {
          await downloadVoice(voiceItem.voiceId, progress => {
            setDownloadProgress(progress);
          });
          await loadVoices();
        } catch (error) {
          console.error('Download failed:', error);
          Alert.alert('Error', `Failed to download voice: ${voiceItem.name}`);
        } finally {
          setDownloadingId(null);
          setDownloadProgress(0);
        }
        return;
      }

      // Select the voice
      await setVoice(voiceItem.voiceId);
      loadVoices(); // Refresh to update selected state
    },
    [setVoice, downloadVoice, loadVoices],
  );

  const renderVoiceItem = ({ item }: { item: VoiceItem }) => {
    const isDownloading = downloadingId === item.voiceId;
    const isSelected = currentVoice?.voiceId === item.voiceId;

    let icon = 'download';
    if (isDownloading) {
      icon = 'download';
    } else if (item.isDownloaded) {
      icon = isSelected ? 'check-circle' : 'check-circle-outline';
    }

    return (
      <List.Item
        title={item.name}
        description={
          isDownloading ? `Downloading... ${downloadProgress}%` : item.language
        }
        icon={icon}
        onPress={() => handleVoiceSelect(item)}
        theme={theme}
      />
    );
  };

  // Group voices by language
  const languages = [...new Set(voices.map(v => v.language))];

  const renderSection = (language: string) => {
    const languageVoices = voices.filter(v => v.language === language);
    return (
      <View key={language} style={styles.section}>
        <List.SubHeader theme={theme}>{language}</List.SubHeader>
        {languageVoices.map(voice => (
          <View key={voice.voiceId}>{renderVoiceItem({ item: voice })}</View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title="Voice Selection"
        handleGoBack={() => navigation.goBack()}
        theme={theme}
      />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={languages}
          renderItem={({ item }) => renderSection(item)}
          keyExtractor={item => item}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

export default VoiceSelectionScreen;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  section: {
    marginBottom: 8,
  },
});
