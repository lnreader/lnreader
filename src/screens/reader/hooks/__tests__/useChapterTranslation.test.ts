import { act, renderHook, waitFor } from '@testing-library/react-native';

import useChapterTranslation from '../useChapterTranslation';
import {
  getTranslationProvider,
  hasApiKey,
  readTranslatedChapter,
  translateChapter,
} from '@services/translation';
import { useTranslationSettings } from '@hooks/persisted/useTranslationSettings';
import { useNovelTranslationSettings } from '@hooks/persisted/useNovelTranslationSettings';
import { ChapterInfo, NovelInfo } from '@database/types';

jest.mock('@services/translation', () => ({
  ...jest.requireActual('@services/translation/types'),
  getTranslationProvider: jest.fn(),
  hasApiKey: jest.fn(),
  readTranslatedChapter: jest.fn(),
  translateChapter: jest.fn(),
}));
jest.mock('@hooks/persisted/useTranslationSettings', () => ({
  useTranslationSettings: jest.fn(),
}));
jest.mock('@hooks/persisted/useNovelTranslationSettings', () => ({
  useNovelTranslationSettings: jest.fn(),
}));
jest.mock('@utils/showToast', () => ({ showToast: jest.fn() }));

const mockedSettings = useTranslationSettings as jest.MockedFunction<
  typeof useTranslationSettings
>;
const mockedNovelSettings = useNovelTranslationSettings as jest.MockedFunction<
  typeof useNovelTranslationSettings
>;
const mockedProvider = getTranslationProvider as jest.Mock;
const mockedHasApiKey = hasApiKey as jest.MockedFunction<typeof hasApiKey>;
const mockedReadCached = readTranslatedChapter as jest.MockedFunction<
  typeof readTranslatedChapter
>;
const mockedTranslate = translateChapter as jest.MockedFunction<
  typeof translateChapter
>;

const novel = { id: 1, pluginId: 'plug', name: 'Novel' } as NovelInfo;
const chapter = { id: 7, novelId: 1, name: 'Ch 1' } as ChapterInfo;
const ORIGINAL = '<p>original</p>';

const setSettings = (overrides: Record<string, unknown> = {}) => {
  mockedSettings.mockReturnValue({
    enabled: true,
    config: {
      provider: 'libretranslate',
      endpoint: 'https://example.test',
      requiresApiKey: false,
    },
    targetLang: 'fr',
    sourceLang: 'auto',
    chunkSize: 40,
    requestDelayMs: 0,
    requestTimeoutMs: 1000,
    setTranslationSettings: jest.fn(),
    setProvider: jest.fn(),
    setProviderConfig: jest.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useTranslationSettings>);
};

const setProviderRequiresKey = (requires: boolean) => {
  mockedProvider.mockReturnValue({
    id: 'libretranslate',
    isLocal: false,
    requiresApiKey: () => requires,
  });
};

const okResult = (html: string) => ({
  html,
  totalChunks: 1,
  failures: [],
  complete: true,
  empty: false,
});

const setNovelSettings = (overrides: Record<string, unknown> = {}) => {
  mockedNovelSettings.mockReturnValue({
    autoTranslate: false,
    targetLang: undefined,
    setNovelTranslationSettings: jest.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useNovelTranslationSettings>);
};

beforeEach(() => {
  jest.clearAllMocks();
  setSettings();
  setNovelSettings();
  setProviderRequiresKey(false);
  mockedReadCached.mockResolvedValue(undefined);
  mockedTranslate.mockResolvedValue(okResult('<p>traduit</p>'));
});

const render = () =>
  renderHook(() => useChapterTranslation(novel, chapter, ORIGINAL));

describe('availability', () => {
  it('hides the control when translation is disabled', () => {
    setSettings({ enabled: false });
    const { result } = render();
    expect(result.current.translation.translationAvailable).toBe(false);
  });

  it('shows the control when the provider needs no key', () => {
    const { result } = render();
    expect(result.current.translation.translationAvailable).toBe(true);
  });

  it('hides the control when a required key is missing', async () => {
    setProviderRequiresKey(true);
    mockedHasApiKey.mockResolvedValue(false);

    const { result } = render();
    await waitFor(() =>
      expect(result.current.translation.translationAvailable).toBe(false),
    );
  });

  it('shows the control once a required key is present', async () => {
    setProviderRequiresKey(true);
    mockedHasApiKey.mockResolvedValue(true);

    const { result } = render();
    await waitFor(() =>
      expect(result.current.translation.translationAvailable).toBe(true),
    );
  });

  it('hides the control when the secure store cannot be read', async () => {
    setProviderRequiresKey(true);
    mockedHasApiKey.mockRejectedValue(new Error('keystore down'));

    const { result } = render();
    await waitFor(() =>
      expect(result.current.translation.translationAvailable).toBe(false),
    );
  });
});

describe('toggling', () => {
  it('renders the original text before translating', () => {
    const { result } = render();
    expect(result.current.displayedHtml).toBe(ORIGINAL);
  });

  it('swaps in the translation on toggle', async () => {
    const { result } = render();

    await act(async () => result.current.translation.toggleTranslation());

    await waitFor(() =>
      expect(result.current.displayedHtml).toBe('<p>traduit</p>'),
    );
    expect(result.current.translation.showTranslation).toBe(true);
  });

  it('reverts to the original on a second toggle', async () => {
    const { result } = render();

    await act(async () => result.current.translation.toggleTranslation());
    await waitFor(() =>
      expect(result.current.translation.showTranslation).toBe(true),
    );

    await act(async () => result.current.translation.toggleTranslation());

    expect(result.current.translation.showTranslation).toBe(false);
    expect(result.current.displayedHtml).toBe(ORIGINAL);
  });

  it('does not re-translate when toggling back on', async () => {
    const { result } = render();

    await act(async () => result.current.translation.toggleTranslation());
    await waitFor(() =>
      expect(result.current.translation.showTranslation).toBe(true),
    );
    await act(async () => result.current.translation.toggleTranslation());
    await act(async () => result.current.translation.toggleTranslation());

    expect(mockedTranslate).toHaveBeenCalledTimes(1);
    expect(result.current.displayedHtml).toBe('<p>traduit</p>');
  });

  it('serves a cached translation without calling the provider', async () => {
    mockedReadCached.mockResolvedValue('<p>from disk</p>');
    const { result } = render();

    await act(async () => result.current.translation.toggleTranslation());

    await waitFor(() =>
      expect(result.current.displayedHtml).toBe('<p>from disk</p>'),
    );
    expect(mockedTranslate).not.toHaveBeenCalled();
  });

  it('keeps showing the original when translation fails', async () => {
    mockedTranslate.mockRejectedValue(new Error('boom'));
    const { result } = render();

    await act(async () => result.current.translation.toggleTranslation());

    await waitFor(() =>
      expect(result.current.translation.translating).toBe(false),
    );
    expect(result.current.displayedHtml).toBe(ORIGINAL);
    expect(result.current.translation.showTranslation).toBe(false);
  });

  it('surfaces partial failures while still showing the translation', async () => {
    mockedTranslate.mockResolvedValue({
      html: '<p>partly</p>',
      totalChunks: 3,
      failures: [
        {
          chunkIndex: 1,
          start: 40,
          count: 40,
          kind: 'rate-limit',
          retryable: true,
          message: 'slow down',
        },
      ],
      complete: false,
      empty: false,
    });

    const { result } = render();
    await act(async () => result.current.translation.toggleTranslation());

    await waitFor(() =>
      expect(result.current.displayedHtml).toBe('<p>partly</p>'),
    );
    expect(result.current.translation.translationFailures).toHaveLength(1);
  });

  it('leaves the original in place when there is nothing to translate', async () => {
    mockedTranslate.mockResolvedValue({
      html: ORIGINAL,
      totalChunks: 0,
      failures: [],
      complete: true,
      empty: true,
    });

    const { result } = render();
    await act(async () => result.current.translation.toggleTranslation());

    await waitFor(() =>
      expect(result.current.translation.translating).toBe(false),
    );
    expect(result.current.translation.showTranslation).toBe(false);
  });

  it('passes the configured languages and pacing to the service', async () => {
    const { result } = render();
    await act(async () => result.current.translation.toggleTranslation());

    await waitFor(() => expect(mockedTranslate).toHaveBeenCalled());
    expect(mockedTranslate).toHaveBeenCalledWith(
      { pluginId: 'plug', novelId: 1, chapterId: 7 },
      expect.objectContaining({
        html: ORIGINAL,
        targetLang: 'fr',
        sourceLang: 'auto',
        chunkSize: 40,
      }),
    );
  });
});

describe('chapter changes', () => {
  it('drops the previous chapter’s translation', async () => {
    const { result, rerender } = renderHook<
      ReturnType<typeof useChapterTranslation>,
      { chap: ChapterInfo; html: string }
    >(({ chap, html }) => useChapterTranslation(novel, chap, html), {
      initialProps: { chap: chapter, html: ORIGINAL },
    });

    await act(async () => result.current.translation.toggleTranslation());
    await waitFor(() =>
      expect(result.current.displayedHtml).toBe('<p>traduit</p>'),
    );

    const nextChapter = { ...chapter, id: 8 } as ChapterInfo;
    rerender({ chap: nextChapter, html: '<p>next chapter</p>' });

    // Critical: never show chapter 7's translation against chapter 8's text.
    expect(result.current.displayedHtml).toBe('<p>next chapter</p>');
    expect(result.current.translation.showTranslation).toBe(false);
  });
});

describe('per-novel settings', () => {
  it('translates on open when auto-translate is on for the novel', async () => {
    setNovelSettings({ autoTranslate: true });

    const { result } = render();

    await waitFor(() =>
      expect(result.current.displayedHtml).toBe('<p>traduit</p>'),
    );
    expect(mockedTranslate).toHaveBeenCalledTimes(1);
  });

  it('does not translate on open when auto-translate is off', async () => {
    const { result } = render();

    await waitFor(() =>
      expect(result.current.translation.translating).toBe(false),
    );
    expect(mockedTranslate).not.toHaveBeenCalled();
    expect(result.current.displayedHtml).toBe(ORIGINAL);
  });

  it('respects an explicit toggle-off over auto-translate', async () => {
    setNovelSettings({ autoTranslate: true });
    const { result } = render();

    await waitFor(() =>
      expect(result.current.translation.showTranslation).toBe(true),
    );

    await act(async () => result.current.translation.toggleTranslation());

    // Auto-translate must not immediately undo the reader's own choice.
    expect(result.current.translation.showTranslation).toBe(false);
    expect(result.current.displayedHtml).toBe(ORIGINAL);
  });

  it('uses the per-novel language override when set', async () => {
    setNovelSettings({ targetLang: 'de' });
    const { result } = render();

    await act(async () => result.current.translation.toggleTranslation());

    await waitFor(() => expect(mockedTranslate).toHaveBeenCalled());
    expect(mockedTranslate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ targetLang: 'de' }),
    );
  });

  it('falls back to the global language when no override is set', async () => {
    const { result } = render();

    await act(async () => result.current.translation.toggleTranslation());

    await waitFor(() => expect(mockedTranslate).toHaveBeenCalled());
    expect(mockedTranslate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ targetLang: 'fr' }),
    );
  });
});
