import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';

import TranslationTab from '../TranslationTab';

let mockSettings: any = {
  enabled: true,
  provider: 'GOOGLE_PA',
  parallelMode: 'PARALLEL_TRANSLATION_FIRST',
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  defaultPromptId: 'balanced',
  googlePaApiKey: '',
  useCommunityGooglePaKey: true,
  geminiApiKey: '',
  geminiModel: 'gemini-2.0-flash',
  openaiApiKey: '',
  openaiEndpoint: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o-mini',
  prompts: [],
  regexRules: [],
  perNovel: {},
};
const mockSetTranslationSettings = jest.fn((values: Partial<any>) => {
  mockSettings = { ...mockSettings, ...values };
});
const mockSetPerNovel = jest.fn();

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({
    background: '#111',
    rippleColor: '#222',
    onSurface: '#333',
    onSurfaceVariant: '#444',
    primary: '#555',
    secondaryContainer: '#666',
    onSecondaryContainer: '#777',
    onPrimary: '#eee',
  }),
  useTranslationSettings: () => ({
    ...mockSettings,
    setTranslationSettings: mockSetTranslationSettings,
    setPerNovelTranslationSettings: mockSetPerNovel,
  }),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { ScrollView } = require('react-native');
  return {
    BottomSheetScrollView: ({ children, contentContainerStyle }: any) =>
      React.createElement(ScrollView, { contentContainerStyle }, children),
  };
});

jest.mock('@components', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  const PassThrough = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);

  const Button = ({ title, onPress }: any) =>
    React.createElement(
      Pressable,
      { onPress },
      React.createElement(Text, null, title),
    );

  const List: any = () => null;
  List.Section = PassThrough;
  List.SubHeader = () => null;
  List.Item = ({ title, onPress }: any) =>
    React.createElement(
      Pressable,
      { onPress },
      React.createElement(Text, null, title),
    );
  List.InfoItem = ({ title }: any) => React.createElement(Text, null, title);

  const SwitchItem = ({ value, label, onPress }: any) =>
    React.createElement(
      Pressable,
      { testID: `switch-${label}`, onPress },
      React.createElement(Text, null, `${label}${value ? ': on' : ': off'}`),
    );

  const OptionPickerDialog = ({ title, options, onSelect, onDismiss }: any) =>
    React.createElement(
      View,
      { testID: `options-${title}` },
      ...options.map((option: any) =>
        React.createElement(
          Pressable,
          { key: option.key, onPress: () => onSelect(option.key) },
          React.createElement(Text, null, option.label),
        ),
      ),
      React.createElement(
        Pressable,
        { onPress: onDismiss },
        React.createElement(Text, null, 'dismiss'),
      ),
    );

  return {
    Button,
    List,
    SwitchItem,
    OptionPickerDialog,
    RegexRulesEditor: () => null,
  };
});

jest.mock('../ReaderSheetPreferenceItem', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return ({ label, value, onPress }: any) =>
    React.createElement(
      Pressable,
      { testID: `pref-${label}`, onPress },
      React.createElement(Text, null, `${label}${value ? ': on' : ': off'}`),
    );
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Chip: ({ children, onPress }: any) =>
      React.createElement(
        Pressable,
        { onPress },
        React.createElement(Text, null, children),
      ),
  };
});

const renderTab = () =>
  render(<TranslationTab novelId={42} onRedoTranslation={onRedoTranslation} />);
const onRedoTranslation = jest.fn();

describe('TranslationTab', () => {
  beforeEach(() => {
    mockSetTranslationSettings.mockClear();
    mockSetPerNovel.mockClear();
    onRedoTranslation.mockClear();
    mockSettings = {
      enabled: true,
      provider: 'GOOGLE_PA',
      parallelMode: 'PARALLEL_TRANSLATION_FIRST',
      sourceLanguage: 'auto',
      targetLanguage: 'en',
      defaultPromptId: 'balanced',
      googlePaApiKey: '',
      useCommunityGooglePaKey: true,
      geminiApiKey: '',
      geminiModel: 'gemini-2.0-flash',
      openaiApiKey: '',
      openaiEndpoint: 'https://api.openai.com/v1',
      openaiModel: 'gpt-4o-mini',
      prompts: [],
      regexRules: [],
      perNovel: {},
    };
  });

  it('toggles the global enable switch', () => {
    renderTab();
    fireEvent.press(screen.getByTestId('pref-translationSettings.enable'));
    expect(mockSetTranslationSettings).toHaveBeenCalledWith({ enabled: false });
  });

  it('applies the parallel mode per novel from a chip', () => {
    renderTab();
    fireEvent.press(
      screen.getByText('translationSettings.parallelModes.ORIGINAL_ONLY'),
    );
    expect(mockSetPerNovel).toHaveBeenCalledWith(42, {
      parallelMode: 'ORIGINAL_ONLY',
    });
  });

  it('sets the per-novel prompt to none from its dialog', () => {
    renderTab();
    fireEvent.press(
      within(
        screen.getByTestId('options-translationSettings.prompt'),
      ).getByText('translationSettings.promptNone'),
    );
    expect(mockSetPerNovel).toHaveBeenCalledWith(42, { promptId: null });
  });

  it('redoes the translation from its button', () => {
    renderTab();
    fireEvent.press(
      screen.getByText('readerScreen.bottomSheet.translationRedo'),
    );
    expect(onRedoTranslation).toHaveBeenCalledTimes(1);
  });
});
