import { useChapterReaderSettings } from '@hooks/persisted/useSettings';
import { act, renderHook } from '@testing-library/react-native';
import type WebView from 'react-native-webview';
import useTextModifications from '../useTextModifications';

jest.mock('@hooks/persisted/useSettings', () => ({
  useChapterReaderSettings: jest.fn(),
}));

describe('Reader text actions', () => {
  const setChapterReaderSettings = jest.fn();
  const injectJavaScript = jest.fn();
  const webViewRef = {
    current: { injectJavaScript } as unknown as WebView<object>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useChapterReaderSettings).mockReturnValue({
      removeText: ['existing removal'],
      replaceText: { original: 'existing replacement' },
      setChapterReaderSettings,
    } as unknown as ReturnType<typeof useChapterReaderSettings>);
  });

  it.each(['remove', 'replace'] as const)(
    'leaves the chapter and settings untouched when the user cancels %s',
    type => {
      const { result } = renderHook(() =>
        useTextModifications('<p>Selected text</p>', webViewRef),
      );
      act(() => {
        result.current.eventTextAction({
          type: 'text-action',
          data: { [type]: 'Selected text' },
        });
      });

      expect(result.current.pendingTextAction).toEqual({
        type,
        text: 'Selected text',
      });
      expect(setChapterReaderSettings).not.toHaveBeenCalled();
      expect(injectJavaScript).not.toHaveBeenCalled();

      act(() => result.current.dismissTextAction());

      expect(result.current.pendingTextAction).toBeNull();
      expect(setChapterReaderSettings).not.toHaveBeenCalled();
      expect(injectJavaScript).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      type: 'remove',
      settings: { removeText: ['existing removal', 'Selected text'] },
      script: 'window.textRemover?.performRemove?.("Selected text"); true;',
    },
    {
      type: 'replace',
      settings: {
        replaceText: {
          original: 'existing replacement',
          'Selected text': 'New text',
        },
      },
      script:
        'window.textRemover?.performReplace?.("Selected text", "New text"); true;',
    },
  ])('applies $type when the user confirms', ({ type, settings, script }) => {
    const { result } = renderHook(() =>
      useTextModifications('<p>Selected text</p>', webViewRef),
    );
    act(() => {
      result.current.eventTextAction({
        type: 'text-action',
        data: { [type]: 'Selected text' },
      });
      if (type === 'replace') result.current.setReplacementText('New text');
    });

    act(() => result.current.confirmTextAction());

    expect(setChapterReaderSettings).toHaveBeenCalledTimes(1);
    expect(setChapterReaderSettings).toHaveBeenCalledWith(settings);
    expect(injectJavaScript).toHaveBeenCalledTimes(1);
    expect(injectJavaScript).toHaveBeenCalledWith(script);
    expect(result.current.pendingTextAction).toBeNull();
    expect(result.current.replacementText).toBe('');
  });
});
