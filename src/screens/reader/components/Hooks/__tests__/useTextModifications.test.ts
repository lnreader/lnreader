import { act, renderHook } from '@testing-library/react-native';
import type WebView from 'react-native-webview';
import useTextModifications from '../useTextModifications';

let mockFilters: string[] = [];
let mockSettings: { removeText: string[]; replaceText: Record<string, string> };
const mockSetSettings = jest.fn((values: Partial<typeof mockSettings>) => {
  mockSettings = { ...mockSettings, ...values };
});

jest.mock('@hooks/persisted/useNovelSettings', () => ({
  useNovelSettings: () => ({ chapterTextFilters: mockFilters }),
}));
jest.mock('@hooks/persisted/useSettings', () => ({
  useChapterReaderSettings: () => ({
    ...mockSettings,
    setChapterReaderSettings: mockSetSettings,
  }),
}));

describe('useTextModifications', () => {
  beforeEach(() => {
    mockFilters = [];
    mockSettings = { removeText: [], replaceText: {} };
    jest.clearAllMocks();
  });

  it('preserves live removals and replacements when adding or deleting novel filters', () => {
    const injectJavaScript = jest.fn();
    const webViewRef = {
      current: { injectJavaScript },
    } as unknown as React.RefObject<WebView<object> | null>;
    const { result, rerender } = renderHook(() =>
      useTextModifications(
        '<p>Remove me. Old name. Advertisement.</p>',
        webViewRef,
      ),
    );
    const originalHtml = result.current.html;

    act(() =>
      result.current.eventTextAction({
        type: 'text-action',
        data: { remove: 'Remove me.' },
      }),
    );
    rerender({});
    act(() =>
      result.current.eventTextAction({
        type: 'text-action',
        data: { replace: 'Old name' },
      }),
    );
    act(() => result.current.setReplacementText('New name'));
    act(() => {
      result.current.handleReplaceSave();
    });
    rerender({});

    // Selection edits update the live DOM without forcing a WebView reload.
    expect(result.current.html).toBe(originalHtml);
    expect(injectJavaScript).toHaveBeenCalledTimes(2);
    mockFilters = ['Advertisement.'];
    rerender({});
    expect(result.current.html).toBe('<p> New name. </p>');
    mockFilters = [];
    rerender({});
    expect(result.current.html).toBe('<p> New name. Advertisement.</p>');
  });
});
