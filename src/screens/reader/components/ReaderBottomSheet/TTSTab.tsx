import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  background,
  clickable,
  clip,
  fillMaxWidth,
  horizontalScroll,
  padding,
  Shapes,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { AppText, Chip, Dialog, List, Slider, SwitchItem } from '@components';
import { getLocales } from 'expo-localization';
import { Tts, TtsEngine, TtsVoice } from '@modules/nitro-tts';
import {
  useTheme,
  useChapterGeneralSettings,
  useChapterReaderSettings,
} from '@hooks/persisted';
import { getString } from '@i18n/translations';
import ChevronRightIcon from '@expo/material-symbols/chevron_right.xml';
import TextToSpeechIcon from '@expo/material-symbols/text_to_speech.xml';
import SettingsVoiceIcon from '@expo/material-symbols/settings_voice.xml';
import VoiceChatIcon from '@expo/material-symbols/voice_chat.xml';
import ArrowForwardIcon from '@expo/material-symbols/arrow_forward.xml';
import UpgradeIcon from '@expo/material-symbols/upgrade.xml';

interface PickerItemProps {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}

const PickerItem = ({
  title,
  subtitle,
  selected,
  onPress,
}: PickerItemProps) => {
  const theme = useTheme();
  return (
    <Row
      verticalAlignment="center"
      modifiers={[
        fillMaxWidth(),
        padding(0, 0, 0, 4),
        clip(Shapes.RoundedCorner(4)),
        ...(selected ? [background(theme.surfaceVariant)] : []),
        clickable(onPress),
        padding(12, 12, 12, 12),
      ]}
    >
      <Column modifiers={[weight(1)]}>
        <AppText variant="bodyLarge" color={theme.onSurface}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySmall" color={theme.onSurfaceVariant}>
            {subtitle}
          </AppText>
        ) : null}
      </Column>
      {selected ? (
        <AppText variant="bodyLarge" color={theme.primary}>
          ✓
        </AppText>
      ) : null}
    </Row>
  );
};

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
    <Dialog.Root visible={visible} onDismiss={handleDismiss}>
      <Dialog.Title>Select Voice</Dialog.Title>
      <Dialog.Content>
        <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 16)]}>
          <AppText
            variant="bodySmall"
            color={theme.onSurfaceVariant}
            modifiers={[padding(0, 0, 0, 8)]}
          >
            Filter by language:
          </AppText>
          <Row
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[fillMaxWidth(), horizontalScroll()]}
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
                  label={lang.toUpperCase() + (isSystemLang ? ' (System)' : '')}
                  theme={theme}
                />
              );
            })}
          </Row>
        </Column>
      </Dialog.Content>
      <Dialog.ScrollArea>
        <PickerItem
          title="System default"
          selected={!currentVoice}
          onPress={() => {
            onSelect(undefined);
            handleDismiss();
          }}
        />
        {filteredVoices.length === 0 ? (
          <AppText
            color={theme.onSurfaceVariant}
            modifiers={[padding(20, 20, 20, 20)]}
          >
            No voices available for selected languages
          </AppText>
        ) : (
          filteredVoices.map((voice: TtsVoice, index: number) => (
            <PickerItem
              key={voice.identifier || index}
              title={voice.name}
              subtitle={voice.language || undefined}
              selected={currentVoice?.identifier === voice.identifier}
              onPress={() => {
                onSelect(voice);
                handleDismiss();
              }}
            />
          ))
        )}
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
  return (
    <Dialog.Root visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>Select Engine</Dialog.Title>
      <Dialog.ScrollArea>
        <PickerItem
          title="System default"
          selected={!currentEngine}
          onPress={() => {
            onSelect(undefined);
            onDismiss();
          }}
        />
        {engines.map(engine => (
          <PickerItem
            key={engine.name}
            title={engine.label}
            selected={currentEngine?.name === engine.name}
            onPress={() => {
              onSelect(engine);
              onDismiss();
            }}
          />
        ))}
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
      <Column modifiers={[fillMaxWidth(), padding(0, 8, 0, 48)]}>
        <List.SubHeader theme={theme}>Text to Speech</List.SubHeader>

        <SwitchItem
          label="Enable TTS"
          icon={TextToSpeechIcon}
          value={TTSEnable}
          onPress={() => setChapterGeneralSettings({ TTSEnable: !TTSEnable })}
          theme={theme}
        />

        {TTSEnable ? (
          <>
            {engines.length > 0 ? (
              <List.Item
                title="Engine"
                icon={SettingsVoiceIcon}
                description={tts?.engine?.label || 'System default'}
                onPress={() => setEngineModalVisible(true)}
                right={ChevronRightIcon}
                theme={theme}
              />
            ) : null}

            <List.Item
              title="Voice"
              icon={VoiceChatIcon}
              description={tts?.voice?.name || 'System default'}
              onPress={() => setVoiceModalVisible(true)}
              right={ChevronRightIcon}
              theme={theme}
            />

            <Column modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}>
              <AppText
                variant="bodyLarge"
                color={theme.onSurface}
                modifiers={[padding(0, 0, 0, 8)]}
              >
                Speed: {tts?.rate?.toFixed(1) || '1.0'}x
              </AppText>
              <Slider
                value={tts?.rate || 1}
                min={0.1}
                max={5}
                step={0.1}
                onSlidingComplete={value =>
                  setChapterReaderSettings({ tts: { ...tts, rate: value } })
                }
              />
            </Column>

            <Column modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}>
              <AppText
                variant="bodyLarge"
                color={theme.onSurface}
                modifiers={[padding(0, 0, 0, 8)]}
              >
                Pitch: {tts?.pitch?.toFixed(1) || '1.0'}
              </AppText>
              <Slider
                value={tts?.pitch || 1}
                min={0.1}
                max={5}
                step={0.1}
                onSlidingComplete={value =>
                  setChapterReaderSettings({ tts: { ...tts, pitch: value } })
                }
              />
            </Column>

            <SwitchItem
              description={getString(
                'readerScreen.bottomSheet.ttsAutoPageAdvanceDescription',
              )}
              label="Auto Page Advance"
              icon={ArrowForwardIcon}
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

            <SwitchItem
              description={getString(
                'readerScreen.bottomSheet.ttsScrollToTopDescription',
              )}
              label="Scroll to Top"
              icon={UpgradeIcon}
              value={tts?.scrollToTop !== false}
              onPress={() =>
                setChapterReaderSettings({
                  tts: { ...tts, scrollToTop: !(tts?.scrollToTop !== false) },
                })
              }
              theme={theme}
            />
          </>
        ) : null}
      </Column>

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
