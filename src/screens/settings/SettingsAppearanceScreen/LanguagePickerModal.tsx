import React from 'react';

import { StyleSheet } from 'react-native';

import { useTheme } from '@hooks/persisted';
import { Dialog, RadioButton } from '@components';
import { getString, setLocale } from '@i18n/translations';
import { useMMKVString } from 'react-native-mmkv';
import { FlatList } from 'react-native-gesture-handler';

interface LanguagePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
}

interface LanguageOption {
  locale: string;
  nativeName: string;
  englishName: string;
}

const languages: LanguageOption[] = [
  { locale: '', nativeName: 'Default', englishName: 'Default' },
  { locale: 'af', nativeName: 'Afrikaans', englishName: 'Afrikaans' },
  { locale: 'ar', nativeName: 'العربية', englishName: 'Arabic' },
  { locale: 'as', nativeName: 'অসমীয়া', englishName: 'Assamese' },
  { locale: 'ca', nativeName: 'Català', englishName: 'Catalan' },
  { locale: 'cs', nativeName: 'Čeština', englishName: 'Czech' },
  { locale: 'da', nativeName: 'Dansk', englishName: 'Danish' },
  { locale: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { locale: 'el', nativeName: 'Ελληνικά', englishName: 'Greek' },
  { locale: 'en', nativeName: 'English', englishName: 'English' },
  { locale: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { locale: 'fi', nativeName: 'Suomi', englishName: 'Finnish' },
  { locale: 'fr', nativeName: 'Français', englishName: 'French' },
  { locale: 'he', nativeName: 'עברית', englishName: 'Hebrew' },
  { locale: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { locale: 'hu', nativeName: 'Magyar', englishName: 'Hungarian' },
  { locale: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian' },
  { locale: 'it', nativeName: 'Italiano', englishName: 'Italian' },
  { locale: 'ja', nativeName: '日本語', englishName: 'Japanese' },
  { locale: 'ko', nativeName: '한국어', englishName: 'Korean' },
  { locale: 'nl', nativeName: 'Nederlands', englishName: 'Dutch' },
  { locale: 'no', nativeName: 'Norsk', englishName: 'Norwegian' },
  { locale: 'or', nativeName: 'ଓଡ଼ିଆ', englishName: 'Odia' },
  { locale: 'pl', nativeName: 'Polski', englishName: 'Polish' },
  { locale: 'pt', nativeName: 'Português', englishName: 'Portuguese' },
  {
    locale: 'pt-BR',
    nativeName: 'Português (Brasil)',
    englishName: 'Portuguese (Brazil)',
  },
  { locale: 'ro', nativeName: 'Română', englishName: 'Romanian' },
  { locale: 'ru', nativeName: 'Русский', englishName: 'Russian' },
  { locale: 'sq', nativeName: 'Shqip', englishName: 'Albanian' },
  { locale: 'sr', nativeName: 'Српски', englishName: 'Serbian' },
  { locale: 'sv', nativeName: 'Svenska', englishName: 'Swedish' },
  { locale: 'tr', nativeName: 'Türkçe', englishName: 'Turkish' },
  { locale: 'uk', nativeName: 'Українська', englishName: 'Ukrainian' },
  { locale: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese' },
  {
    locale: 'zh-CN',
    nativeName: '简体中文',
    englishName: 'Chinese (Simplified)',
  },
  {
    locale: 'zh-TW',
    nativeName: '繁體中文',
    englishName: 'Chinese (Traditional)',
  },
];

const LanguagePickerModal: React.FC<LanguagePickerModalProps> = ({
  onDismiss,
  visible,
}) => {
  const theme = useTheme();
  const [currentLocale = ''] = useMMKVString('APP_LOCALE');

  const handleLanguageSelect = (locale: string) => {
    setLocale(locale);
    onDismiss();
  };

  return (
    <Dialog.Root
      visible={visible}
      onDismiss={onDismiss}
      surfaceStyle={styles.maxHeight}
    >
      <Dialog.Header>
        <Dialog.Title>{getString('appearanceScreen.appLanguage')}</Dialog.Title>
        <Dialog.Description>
          {getString('appearanceScreen.languagePickerModal.restartNote')}
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.ScrollArea>
        <FlatList
          data={languages}
          keyExtractor={item => item.locale}
          renderItem={({ item }) => (
            <RadioButton
              key={item.locale}
              status={currentLocale === item.locale}
              onPress={() => handleLanguageSelect(item.locale)}
              label={item.nativeName}
              theme={theme}
            />
          )}
        />
      </Dialog.ScrollArea>
    </Dialog.Root>
  );
};

export default LanguagePickerModal;

const styles = StyleSheet.create({
  maxHeight: { maxHeight: '60%' },
});
