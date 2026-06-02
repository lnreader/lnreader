import React from 'react';
import { StyleSheet, Text, ScrollView } from 'react-native';
import { Portal } from 'react-native-paper';
import { useTheme } from '@hooks/persisted';
import { Modal, RadioButton } from '@components';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Chinese (Simplified)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ru', label: 'Russian' },
  { code: 'id', label: 'Indonesian' },
];

export interface LanguagePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  currentLanguage: string;
  onSelect: (lang: string) => void;
  languages: { code: string; label: string }[];
}

export const LanguagePickerModal: React.FC<LanguagePickerModalProps> = ({
  visible,
  onDismiss,
  currentLanguage,
  onSelect,
  languages,
}) => {
  const theme = useTheme();

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss}>
        <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
          Translate to
        </Text>
        <ScrollView style={styles.scroll}>
          {languages.map(item => (
            <RadioButton
              key={item.code}
              status={currentLanguage === item.code}
              onPress={() => {
                onSelect(item.code);
                onDismiss();
              }}
              label={item.label}
              theme={theme}
            />
          ))}
        </ScrollView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  scroll: {
    maxHeight: 300,
  },
});
