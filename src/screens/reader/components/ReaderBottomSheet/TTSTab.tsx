import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Pressable, View, StyleSheet, Text, ScrollView } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Button, Dialog, List, Slider } from '@components';
import { getLocales } from 'expo-localization';
import { Tts, TtsEngine, TtsVoice } from '@modules/nitro-tts';
import {
  useTheme,
  useChapterGeneralSettings,
  useChapterReaderSettings,
} from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { Chip } from 'react-native-paper';
import ReaderSheetPreferenceItem from './ReaderSheetPreferenceItem';

interface VoicePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  voices: TtsVoice[];
  onSelect: (voice?: TtsVoice) => void;
  currentVoice?: TtsVoice;
}

const VoicePickerModal: React.FC<VoicePickerModalProps> = ({
  visible,
  onDismiss,
  voices,
  onSelect,
  currentVoice,
}) => {
  const theme = useTheme();
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  // Get system language safely using getLocales()
  const systemLocale = getLocales()[0]?.languageCode || 'en';

  // Get unique languages from voices
  const availableLanguages = useMemo(() => {
    const languages = new Set<string>();
    voices.forEach(voice => {
      if (voice.language) {
        const lang = voice.language.split('-')[0];
        languages.add(lang);
      }
    });
    return Array.from(languages).sort((a, b) => {
      // System language first
      if (a === systemLocale) return -1;
      if (b === systemLocale) return 1;
      return a.localeCompare(b);
    });
  }, [voices, systemLocale]);

  // Filter voices by selected languages
  const filteredVoices = useMemo(() => {
    if (selectedLanguages.length === 0) {
      // Show system language voices by default
      return voices.filter(voice => {
        const lang = voice.language?.split('-')[0];
        return lang === systemLocale;
      });
    }

    return voices.filter(voice => {
      const lang = voice.language?.split('-')[0];
      return lang && selectedLanguages.includes(lang);
    });
  }, [voices, selectedLanguages, systemLocale]);

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev => {
      if (prev.includes(lang)) {
        return prev.filter(l => l !== lang);
      } else {
        return [...prev, lang];
      }
    });
  };

  const handleDismiss = () => {
    setSelectedLanguages([]);
    onDismiss();
  };

  return (
    <Dialog.Root
      visible={visible}
      onDismiss={handleDismiss}
      surfaceStyle={styles.modalContent}
    >
      <Dialog.Title>Select Voice</Dialog.Title>
      <Dialog.Content>
        <View style={styles.languageFilterContainer}>
          <Text style={[styles.filterLabel, { color: theme.onSurfaceVariant }]}>
            Filter by language:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.languageChipsScroll}
          >
            {availableLanguages.map(lang => {
              const isSelected = selectedLanguages.includes(lang);
              const isSystemLang = lang === systemLocale;
              const showingSystemOnly = selectedLanguages.length === 0;
              const isActive =
                isSelected || (showingSystemOnly && isSystemLang);

              return (
                <Chip
                  key={lang}
                  selected={isActive}
                  onPress={() => toggleLanguage(lang)}
                  style={[
                    styles.languageChip,
                    isActive && { backgroundColor: theme.primary },
                  ]}
                  textStyle={[
                    styles.languageChipText,
                    { color: isActive ? theme.onPrimary : theme.onSurface },
                  ]}
                >
                  {lang.toUpperCase()}
                  {isSystemLang && ' (System)'}
                </Chip>
              );
            })}
          </ScrollView>
        </View>
      </Dialog.Content>
      <Dialog.ScrollArea>
        <ScrollView style={styles.voiceList}>
          <Pressable
            style={[
              styles.voiceItem,
              !currentVoice && { backgroundColor: theme.surfaceVariant },
            ]}
            onPress={() => {
              onSelect(undefined);
              handleDismiss();
            }}
          >
            <View style={styles.voiceItemContent}>
              <Text style={[styles.voiceItemText, { color: theme.onSurface }]}>
                System default
              </Text>
            </View>
            {!currentVoice ? (
              <Text style={[styles.checkIcon, { color: theme.primary }]}>
                ✓
              </Text>
            ) : null}
          </Pressable>
          {filteredVoices.length === 0 ? (
            <Text
              style={[styles.noVoicesText, { color: theme.onSurfaceVariant }]}
            >
              No voices available for selected languages
            </Text>
          ) : (
            filteredVoices.map((voice: TtsVoice, index: number) => (
              <Pressable
                key={voice.identifier || index}
                style={[
                  styles.voiceItem,
                  currentVoice?.identifier === voice.identifier && {
                    backgroundColor: theme.surfaceVariant,
                  },
                ]}
                onPress={() => {
                  onSelect(voice);
                  handleDismiss();
                }}
              >
                <View style={styles.voiceItemContent}>
                  <Text
                    style={[styles.voiceItemText, { color: theme.onSurface }]}
                  >
                    {voice.name}
                  </Text>
                  {voice.language ? (
                    <Text
                      style={[
                        styles.voiceItemLanguage,
                        { color: theme.onSurfaceVariant },
                      ]}
                    >
                      {voice.language}
                    </Text>
                  ) : null}
                </View>
                {currentVoice?.identifier === voice.identifier ? (
                  <Text style={[styles.checkIcon, { color: theme.primary }]}>
                    ✓
                  </Text>
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action onPress={handleDismiss}>Cancel</Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

interface EnginePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  engines: TtsEngine[];
  onSelect: (engine?: TtsEngine) => void;
  currentEngine?: TtsEngine;
}

const EnginePickerModal: React.FC<EnginePickerModalProps> = ({
  visible,
  onDismiss,
  engines,
  onSelect,
  currentEngine,
}) => {
  const theme = useTheme();

  return (
    <Dialog.Root
      visible={visible}
      onDismiss={onDismiss}
      surfaceStyle={styles.modalContent}
    >
      <Dialog.Title>Select Engine</Dialog.Title>
      <Dialog.ScrollArea>
        <ScrollView style={styles.voiceList}>
          <Pressable
            style={[
              styles.voiceItem,
              !currentEngine && { backgroundColor: theme.surfaceVariant },
            ]}
            onPress={() => {
              onSelect(undefined);
              onDismiss();
            }}
          >
            <View style={styles.voiceItemContent}>
              <Text style={[styles.voiceItemText, { color: theme.onSurface }]}>
                System default
              </Text>
            </View>
            {!currentEngine ? (
              <Text style={[styles.checkIcon, { color: theme.primary }]}>
                ✓
              </Text>
            ) : null}
          </Pressable>
          {engines.map(engine => (
            <Pressable
              key={engine.name}
              style={[
                styles.voiceItem,
                currentEngine?.name === engine.name && {
                  backgroundColor: theme.surfaceVariant,
                },
              ]}
              onPress={() => {
                onSelect(engine);
                onDismiss();
              }}
            >
              <View style={styles.voiceItemContent}>
                <Text
                  style={[styles.voiceItemText, { color: theme.onSurface }]}
                >
                  {engine.label}
                </Text>
              </View>
              {currentEngine?.name === engine.name ? (
                <Text style={[styles.checkIcon, { color: theme.primary }]}>
                  ✓
                </Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action onPress={onDismiss}>Cancel</Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

const TTSTab: React.FC = () => {
  const theme = useTheme();
  const { TTSEnable = true, setChapterGeneralSettings } =
    useChapterGeneralSettings();

  const { tts, setChapterReaderSettings } = useChapterReaderSettings();
  const [engines, setEngines] = useState<TtsEngine[]>([]);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [engineModalVisible, setEngineModalVisible] = useState(false);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

  // Android only; resolves empty on iOS, which hides the Engine row below.
  useEffect(() => {
    Tts.getEngines().then(res => {
      setEngines([...res].sort((a, b) => a.label.localeCompare(b.label)));
    });
  }, []);

  // Voices belong to a specific engine, so refetch whenever it changes.
  const engineName = tts?.engine?.name;
  useEffect(() => {
    Tts.getVoices(engineName).then(res => {
      setVoices([...res].sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, [engineName]);

  const handleEngineSelect = useCallback(
    (engine?: TtsEngine) => {
      // Voice identifiers are engine-scoped, so switching engines clears the
      // previously selected voice rather than carrying over a stale one.
      setChapterReaderSettings({
        tts: { ...tts, engine, voice: undefined },
      });
    },
    [tts, setChapterReaderSettings],
  );

  const handleVoiceSelect = useCallback(
    (voice?: TtsVoice) => {
      setChapterReaderSettings({ tts: { ...tts, voice } });
    },
    [tts, setChapterReaderSettings],
  );

  return (
    <>
      <BottomSheetScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.section}>
          <List.SubHeader theme={theme}>Text to Speech</List.SubHeader>

          <ReaderSheetPreferenceItem
            label="Enable TTS"
            value={TTSEnable}
            onPress={() => setChapterGeneralSettings({ TTSEnable: !TTSEnable })}
            theme={theme}
          />

          {TTSEnable ? (
            <>
              {engines.length > 0 ? (
                <Pressable
                  style={styles.settingItem}
                  onPress={() => setEngineModalVisible(true)}
                >
                  <Text style={[styles.label, { color: theme.onSurface }]}>
                    Engine
                  </Text>
                  <Text
                    style={[styles.value, { color: theme.onSurfaceVariant }]}
                  >
                    {tts?.engine?.label || 'System default'}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                style={styles.settingItem}
                onPress={() => setVoiceModalVisible(true)}
              >
                <Text style={[styles.label, { color: theme.onSurface }]}>
                  Voice
                </Text>
                <Text style={[styles.value, { color: theme.onSurfaceVariant }]}>
                  {tts?.voice?.name || 'System default'}
                </Text>
              </Pressable>

              <View style={styles.sliderSection}>
                <Text style={[styles.sliderLabel, { color: theme.onSurface }]}>
                  Speed: {tts?.rate?.toFixed(1) || '1.0'}x
                </Text>
                <Slider
                  style={styles.slider}
                  value={tts?.rate || 1}
                  min={0.1}
                  max={5}
                  step={0.1}
                  showValueIndicator
                  formatValue={value => `${value.toFixed(1)}x`}
                  accessibilityLabel="Text to speech speed"
                  onSlidingComplete={value =>
                    setChapterReaderSettings({ tts: { ...tts, rate: value } })
                  }
                />
              </View>

              <View style={styles.sliderSection}>
                <Text style={[styles.sliderLabel, { color: theme.onSurface }]}>
                  Pitch: {tts?.pitch?.toFixed(1) || '1.0'}
                </Text>
                <Slider
                  style={styles.slider}
                  value={tts?.pitch || 1}
                  min={0.1}
                  max={5}
                  step={0.1}
                  showValueIndicator
                  formatValue={value => value.toFixed(1)}
                  accessibilityLabel="Text to speech pitch"
                  onSlidingComplete={value =>
                    setChapterReaderSettings({ tts: { ...tts, pitch: value } })
                  }
                />
              </View>

              <ReaderSheetPreferenceItem
                label="Auto Page Advance"
                value={tts?.autoPageAdvance === true}
                onPress={() =>
                  setChapterReaderSettings({
                    tts: {
                      ...tts,
                      autoPageAdvance: !(tts?.autoPageAdvance === true),
                    },
                  })
                }
                theme={theme}
              />

              <ReaderSheetPreferenceItem
                label="Scroll to Top"
                value={tts?.scrollToTop !== false}
                onPress={() =>
                  setChapterReaderSettings({
                    tts: { ...tts, scrollToTop: !(tts?.scrollToTop !== false) },
                  })
                }
                theme={theme}
              />

              <View style={styles.resetButtonContainer}>
                <Button
                  title={getString('common.reset')}
                  mode="outlined"
                  onPress={() => {
                    setChapterReaderSettings({
                      tts: {
                        pitch: 1,
                        rate: 1,
                        engine: undefined,
                        voice: undefined,
                        autoPageAdvance: false,
                        scrollToTop: true,
                      },
                    });
                  }}
                  style={styles.resetButton}
                />
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.bottomSpacing} />
      </BottomSheetScrollView>

      <EnginePickerModal
        visible={engineModalVisible}
        onDismiss={() => setEngineModalVisible(false)}
        engines={engines}
        onSelect={handleEngineSelect}
        currentEngine={tts?.engine}
      />
      <VoicePickerModal
        visible={voiceModalVisible}
        onDismiss={() => setVoiceModalVisible(false)}
        voices={voices}
        onSelect={handleVoiceSelect}
        currentVoice={tts?.voice}
      />
    </>
  );
};

export default React.memo(TTSTab);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  section: {
    marginVertical: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 14,
  },
  sliderSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sliderLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  slider: {
    marginHorizontal: -10,
  },
  resetButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resetButton: {
    alignSelf: 'flex-start',
  },
  bottomSpacing: {
    height: 24,
  },
  modalContent: {
    maxHeight: '80%',
  },
  languageFilterContainer: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  languageChipsScroll: {
    flexGrow: 0,
  },
  languageChip: {
    marginEnd: 8,
    marginBottom: 8,
  },
  voiceList: {
    maxHeight: 350,
    marginTop: 8,
  },
  voiceItem: {
    borderCurve: 'continuous',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 4,
  },
  voiceItemContent: {
    flex: 1,
  },
  voiceItemText: {
    fontSize: 16,
    marginBottom: 4,
  },
  voiceItemLanguage: {
    fontSize: 12,
  },
  noVoicesText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },
  languageChipText: {
    fontSize: 12,
  },
  checkIcon: {
    fontSize: 16,
  },
});
