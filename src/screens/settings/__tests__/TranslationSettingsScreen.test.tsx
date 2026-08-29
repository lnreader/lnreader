import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';

import TranslationSettingsScreen from '../TranslationSettingsScreen';

let mockSettings: any = {
  enabled: false,
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

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({
    background: '#111',
    rippleColor: '#222',
    onSurface: '#333',
    onSurfaceVariant: '#444',
    primary: '#555',
    secondaryContainer: '#666',
    onSecondaryContainer: '#777',
  }),
  useTranslationSettings: () => ({
    ...mockSettings,
    setTranslationSettings: mockSetTranslationSettings,
    setPerNovelTranslationSettings: jest.fn(),
  }),
}));

jest.mock('@hooks', () => ({
  useBoolean: () => ({
    value: true,
    setValue: () => {},
    setTrue: () => {},
    setFalse: () => {},
    toggle: () => {},
  }),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@components', () => {
  const React = require('react');
  const { Pressable, TextInput, Text, View } = require('react-native');

  const PassThrough = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);

  const Dialog: any = () => null;
  Dialog.Root = PassThrough;
  Dialog.Header = PassThrough;
  Dialog.Title = PassThrough;
  Dialog.Content = PassThrough;
  Dialog.ScrollArea = PassThrough;
  Dialog.Actions = PassThrough;
  Dialog.Action = ({ children, onPress }: any) =>
    React.createElement(
      Pressable,
      { onPress },
      React.createElement(Text, null, children),
    );

  const List: any = () => null;
  List.Section = PassThrough;
  List.SubHeader = () => null;
  List.Item = ({ title, description, onPress }: any) =>
    React.createElement(
      Pressable,
      { onPress },
      React.createElement(
        Text,
        null,
        `${title}${description ? `: ${description}` : ''}`,
      ),
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
    SafeAreaView: PassThrough,
    Appbar: () => null,
    TextInput,
    Dialog,
    List,
    SwitchItem,
    OptionPickerDialog,
    RegexRulesEditor: () => null,
    PromptsManager: () => null,
  };
});

describe('TranslationSettingsScreen', () => {
  beforeEach(() => {
    mockSetTranslationSettings.mockClear();
    mockSettings = {
      enabled: false,
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

  const renderScreen = () =>
    render(
      <TranslationSettingsScreen navigation={{} as any} route={{} as any} />,
    );

  it('toggles the global enable switch', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('switch-translationSettings.enable'));
    expect(mockSetTranslationSettings).toHaveBeenCalledWith({ enabled: true });
  });

  it('selects the provider from its dialog', () => {
    mockSettings = { ...mockSettings, enabled: true };
    renderScreen();
    fireEvent.press(
      screen.getByText(
        'translationSettings.mainProvider: translationSettings.providers.google_pa',
      ),
    );
    fireEvent.press(
      within(
        screen.getByTestId('options-translationSettings.mainProvider'),
      ).getByText('translationSettings.providers.gemini'),
    );
    expect(mockSetTranslationSettings).toHaveBeenCalledWith({
      provider: 'GEMINI',
    });
  });

  it('selects a target language from its dialog', () => {
    mockSettings = { ...mockSettings, enabled: true };
    renderScreen();
    fireEvent.press(
      screen.getByText('translationSettings.targetLanguage: English'),
    );
    fireEvent.press(
      within(
        screen.getByTestId('options-translationSettings.targetLanguage'),
      ).getByText('Japanese'),
    );
    expect(mockSetTranslationSettings).toHaveBeenCalledWith({
      targetLanguage: 'ja',
    });
  });

  it('selects the default parallel mode from its dialog', () => {
    mockSettings = { ...mockSettings, enabled: true };
    renderScreen();
    fireEvent.press(
      screen.getByText(
        'translationSettings.parallelMode: translationSettings.parallelModes.PARALLEL_TRANSLATION_FIRST',
      ),
    );
    fireEvent.press(
      within(
        screen.getByTestId('options-translationSettings.parallelMode'),
      ).getByText('translationSettings.parallelModes.ORIGINAL_ONLY'),
    );
    expect(mockSetTranslationSettings).toHaveBeenCalledWith({
      parallelMode: 'ORIGINAL_ONLY',
    });
  });
});
