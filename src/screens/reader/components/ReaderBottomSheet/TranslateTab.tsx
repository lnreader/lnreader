import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme, useTranslateSettings } from '@hooks/persisted';
import { List, Button } from '@components/index';
import { Portal, Modal } from 'react-native-paper';
import ReaderSheetPreferenceItem from './ReaderSheetPreferenceItem';
import { clearTranslationCache } from '@utils/translate';
import { getString } from '@strings/translations';
import { showToast } from '@utils/showToast';

export const LANGUAGES = [
  { label: 'English', code: 'en' },
  ...[
    { label: 'Arabic', code: 'ar' },
    { label: 'Spanish', code: 'es' },
    { label: 'French', code: 'fr' },
    { label: 'German', code: 'de' },
    { label: 'Russian', code: 'ru' },
    { label: 'Portuguese', code: 'pt' },
    { label: 'Chinese', code: 'zh' },
    { label: 'Japanese', code: 'ja' },
    { label: 'Korean', code: 'ko' },
    { label: 'Italian', code: 'it' },
    { label: 'Vietnamese', code: 'vi' },
    { label: 'Turkish', code: 'tr' },
    { label: 'Indonesian', code: 'id' },
    { label: 'Polish', code: 'pl' },
    { label: 'Dutch', code: 'nl' },
  ].sort((a, b) => a.label.localeCompare(b.label)),
];

const COLOR_PRESETS = [
  '#6b7280', // Default Gray
  '#4b5563', // Dark Gray
  '#9ca3af', // Light Gray
  '#475569', // Slate
  '#3b82f6', // Muted Blue
  '#10b981', // Muted Green
  '#ef4444', // Muted Red
  '#f59e0b', // Muted Yellow
];

interface LanguagePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (code: string) => void;
  currentLanguage: string;
}

export const LanguagePickerModal: React.FC<LanguagePickerModalProps> = ({
  visible,
  onDismiss,
  onSelect,
  currentLanguage,
}) => {
  const theme = useTheme();

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContent,
          { backgroundColor: theme.surface },
        ]}
      >
        <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
          {getString('translation.selectTargetLanguage')}
        </Text>
        <ScrollView style={styles.languageList}>
          {LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageItem,
                currentLanguage === lang.code && {
                  backgroundColor: theme.surfaceVariant,
                },
              ]}
              onPress={() => {
                onSelect(lang.code);
                onDismiss();
              }}
            >
              <Text
                style={[styles.languageItemText, { color: theme.onSurface }]}
              >
                {lang.label} ({lang.code.toUpperCase()})
              </Text>
              {currentLanguage === lang.code && (
                <Text style={[styles.checkIcon, { color: theme.primary }]}>
                  ✓
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Button
          title={getString('common.cancel')}
          mode="outlined"
          onPress={onDismiss}
          style={styles.cancelButton}
        />
      </Modal>
    </Portal>
  );
};

const TranslateTab: React.FC = () => {
  const theme = useTheme();
  const {
    translateEnabled,
    translateMode,
    translateTargetLanguage,
    translateColor,
    translateItalic,
    translateUnderline,
    setTranslateSettings,
  } = useTranslateSettings();

  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const getLanguageLabel = useCallback((code: string) => {
    const lang = LANGUAGES.find(l => l.code === code);
    return lang ? lang.label : code.toUpperCase();
  }, []);

  return (
    <>
      <BottomSheetScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.section}>
          <List.SubHeader theme={theme}>
            {getString('translation.googleTranslate')}
          </List.SubHeader>

          <ReaderSheetPreferenceItem
            label={getString('translation.enableTranslation')}
            value={translateEnabled}
            onPress={() =>
              setTranslateSettings({ translateEnabled: !translateEnabled })
            }
            theme={theme}
          />

          {translateEnabled && (
            <>
              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => setLanguageModalVisible(true)}
              >
                <Text style={[styles.label, { color: theme.onSurface }]}>
                  {getString('translation.targetLanguage')}
                </Text>
                <Text style={[styles.value, { color: theme.onSurfaceVariant }]}>
                  {getLanguageLabel(translateTargetLanguage)}
                </Text>
              </TouchableOpacity>

              <View style={styles.segmentedRow}>
                <Text style={[styles.label, { color: theme.onSurface }]}>
                  {getString('translation.translationMode')}
                </Text>
                <View style={styles.modesContainer}>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      { borderColor: theme.outline },
                      translateMode === 'dual' && {
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                      },
                    ]}
                    onPress={() =>
                      setTranslateSettings({ translateMode: 'dual' })
                    }
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        {
                          color:
                            translateMode === 'dual'
                              ? theme.onPrimary
                              : theme.onSurface,
                        },
                      ]}
                    >
                      {getString('translation.dualText')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      { borderColor: theme.outline },
                      translateMode === 'translated' && {
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                      },
                    ]}
                    onPress={() =>
                      setTranslateSettings({ translateMode: 'translated' })
                    }
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        {
                          color:
                            translateMode === 'translated'
                              ? theme.onPrimary
                              : theme.onSurface,
                        },
                      ]}
                    >
                      {getString('translation.translatedOnly')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {translateMode === 'dual' && (
                <>
                  <List.SubHeader theme={theme}>
                    {getString('translation.translationTypography')}
                  </List.SubHeader>

                  <ReaderSheetPreferenceItem
                    label={getString('translation.italicText')}
                    value={translateItalic}
                    onPress={() =>
                      setTranslateSettings({
                        translateItalic: !translateItalic,
                      })
                    }
                    theme={theme}
                  />

                  <ReaderSheetPreferenceItem
                    label={getString('translation.underlinedText')}
                    value={translateUnderline}
                    onPress={() =>
                      setTranslateSettings({
                        translateUnderline: !translateUnderline,
                      })
                    }
                    theme={theme}
                  />

                  <View style={styles.colorRow}>
                    <Text
                      style={[styles.colorLabel, { color: theme.onSurface }]}
                    >
                      {getString('translation.textColor')}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.colorList}
                    >
                      {COLOR_PRESETS.map(color => (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.colorButton,
                            { backgroundColor: color },
                            translateColor === color &&
                              styles.colorButtonActive,
                            translateColor === color && {
                              borderColor: theme.primary,
                            },
                          ]}
                          onPress={() =>
                            setTranslateSettings({ translateColor: color })
                          }
                        />
                      ))}
                    </ScrollView>
                  </View>
                </>
              )}
            </>
          )}

          <List.SubHeader theme={theme}>
            {getString('translation.advanced')}
          </List.SubHeader>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              clearTranslationCache();
              showToast('Translation cache cleared');
            }}
          >
            <Text style={[styles.label, { color: theme.onSurface }]}>
              {getString('translation.clearTranslationCache')}
            </Text>
            <Text style={[styles.value, { color: theme.primary }]}>
              {getString('common.clear')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />
      </BottomSheetScrollView>

      <LanguagePickerModal
        visible={languageModalVisible}
        onDismiss={() => setLanguageModalVisible(false)}
        currentLanguage={translateTargetLanguage}
        onSelect={code =>
          setTranslateSettings({ translateTargetLanguage: code })
        }
      />
    </>
  );
};

export default React.memo(TranslateTab);

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
  segmentedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modesContainer: {
    flexDirection: 'row',
  },
  modeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginLeft: 8,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  colorList: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  colorButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginHorizontal: 4,
  },
  colorButtonActive: {
    borderWidth: 2,
  },
  label: {
    fontSize: 16,
  },
  colorLabel: {
    fontSize: 16,
    marginRight: 16,
  },
  value: {
    fontSize: 14,
  },
  bottomSpacing: {
    height: 24,
  },
  modalContent: {
    margin: 20,
    borderRadius: 8,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  languageList: {
    maxHeight: 350,
    marginTop: 8,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 4,
    marginBottom: 4,
  },
  languageItemText: {
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 16,
  },
  checkIcon: {
    fontSize: 16,
  },
});
