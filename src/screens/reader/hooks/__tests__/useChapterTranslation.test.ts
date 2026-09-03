import { renderHook, waitFor } from '@testing-library/react-native';

import { translateParagraphs } from '@api/translation';
import {
  getChapterTranslationFromDb,
  upsertChapterTranslation,
} from '@database/queries/ChapterTranslationQueries';
import {
  getTranslationSettings,
  useTranslationSettings,
} from '@hooks/persisted/useTranslationSettings';
import { getString } from '@i18n/translations';
import { showToast } from '@utils/showToast';
import { useChapterContext } from '../../ChapterContext';
import { useChapterTranslation } from '../useChapterTranslation';

jest.mock('../../ChapterContext', () => ({
  useChapterContext: jest.fn(() => ({
    novel: { id: 42, path: '/novel' },
    chapter: { id: 7, path: '/chapter-7', name: 'Ch 7' },
  })),
}));

jest.mock('@hooks/persisted/useTranslationSettings');
jest.mock('@database/queries/ChapterTranslationQueries', () => ({
  getChapterTranslationFromDb: jest.fn(),
  upsertChapterTranslation: jest.fn(),
  deleteChapterTranslationByNovel: jest.fn(),
}));
jest.mock('@api/translation', () => ({
  translateParagraphs: jest.fn(),
}));
jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));
jest.mock('@i18n/translations', () => ({
  getString: jest.fn((key: string) => key),
}));

const mockedUseChapterContext = useChapterContext as jest.Mock;
const mockedUseTranslationSettings = useTranslationSettings as jest.Mock;
const mockedGetTranslationSettings = getTranslationSettings as jest.Mock;
const mockedTranslateParagraphs = translateParagraphs as jest.Mock;
const mockedGetChapterTranslation = getChapterTranslationFromDb as jest.Mock;
const mockedUpsertChapterTranslation = upsertChapterTranslation as jest.Mock;
const mockedGetString = getString as jest.Mock;
const mockedShowToast = showToast as jest.Mock;

const enabledSettings = () => ({
  enabled: true,
  provider: 'GOOGLE_PA',
  parallelMode: 'PARALLEL_TRANSLATION_FIRST',
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  defaultPromptId: 'balanced',
  googlePaApiKey: '',
  useCommunityGooglePaKey: true,
  googlePaApiKeys: '',
  googlePaCachedKey: '',
  googlePaKeyLastChecked: 0,
  batchSize: 60,
  maxOutputTokens: 0,
  geminiApiKey: '',
  geminiModel: 'gemini-2.0-flash',
  openaiApiKey: '',
  openaiEndpoint: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o-mini',
  prompts: [],
  regexRules: [],
  perNovel: {},
});

const setup = () => {
  const injectJavaScript = jest.fn((_script: string) => {});
  const webViewRef = { current: { injectJavaScript } };
  const activeChapterIdRef = { current: 7 };
  const { result } = renderHook(() =>
    useChapterTranslation(
      webViewRef as unknown as Parameters<typeof useChapterTranslation>[0],
      activeChapterIdRef,
    ),
  );
  return { result, injectJavaScript };
};

const payloadOf = (script: string) => {
  const match = /applyTranslation\?\.\((.*)\);\s*true;/.exec(script);
  if (!match) return null;
  return JSON.parse(match[1]) as {
    config: { enabled: boolean; parallelMode: string };
    paragraphs: string[];
    translations: string[];
  };
};

describe('useChapterTranslation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseChapterContext.mockReturnValue({
      novel: { id: 42, path: '/novel' },
      chapter: { id: 7, path: '/chapter-7', name: 'Ch 7' },
    });
    mockedUseTranslationSettings.mockReturnValue({
      ...enabledSettings(),
      setTranslationSettings: jest.fn(),
      setPerNovelTranslationSettings: jest.fn(),
    });
    mockedGetTranslationSettings.mockReturnValue(enabledSettings());
  });

  it('ignores translation requests while translation is disabled', () => {
    mockedUseTranslationSettings.mockReturnValue({
      ...enabledSettings(),
      enabled: false,
      setTranslationSettings: jest.fn(),
      setPerNovelTranslationSettings: jest.fn(),
    });
    const { result, injectJavaScript } = setup();
    result.current.onTranslationRequest(['Hello world']);
    expect(mockedTranslateParagraphs).not.toHaveBeenCalled();
    expect(mockedGetChapterTranslation).not.toHaveBeenCalled();
    expect(injectJavaScript).not.toHaveBeenCalled();
  });

  it('translates, caches and injects the result when no cache exists', async () => {
    mockedGetChapterTranslation.mockResolvedValue(null);
    mockedTranslateParagraphs.mockResolvedValue(['Xin chào thế giới']);
    const { result, injectJavaScript } = setup();

    result.current.onTranslationRequest(['Hello world']);
    await waitFor(() => expect(injectJavaScript).toHaveBeenCalled());

    expect(mockedTranslateParagraphs).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'GOOGLE_PA',
        texts: ['Hello world'],
        sourceLanguage: 'auto',
        targetLanguage: 'en',
      }),
    );

    const payload = payloadOf(injectJavaScript.mock.calls[0][0] as string);
    expect(payload?.config).toEqual({
      enabled: true,
      parallelMode: 'PARALLEL_TRANSLATION_FIRST',
    });
    expect(payload?.paragraphs).toEqual(['Hello world']);
    expect(payload?.translations).toEqual(['Xin chào thế giới']);

    expect(mockedUpsertChapterTranslation).toHaveBeenCalledWith(
      {
        novelId: 42,
        path: '/chapter-7',
        provider: 'GOOGLE_PA',
        sourceLanguage: 'auto',
        targetLanguage: 'en',
      },
      ['Xin chào thế giới'],
    );
  });

  it('serves an existing chapter translation from the cache without re-translating', async () => {
    mockedGetChapterTranslation.mockResolvedValue(['Bản gốc lưu trữ']);
    const { result, injectJavaScript } = setup();

    result.current.onTranslationRequest(['Original text']);
    await waitFor(() => expect(injectJavaScript).toHaveBeenCalled());

    expect(mockedTranslateParagraphs).not.toHaveBeenCalled();
    expect(mockedUpsertChapterTranslation).not.toHaveBeenCalled();
    const payload = payloadOf(injectJavaScript.mock.calls[0][0] as string);
    expect(payload?.translations).toEqual(['Bản gốc lưu trữ']);
  });

  it('re-translates past the cache when forced', async () => {
    mockedGetChapterTranslation.mockResolvedValue(['Cached text']);
    mockedTranslateParagraphs.mockResolvedValue(['Fresh text']);
    const { result, injectJavaScript } = setup();

    result.current.onTranslationRequest(['Original text'], true);
    await waitFor(() => expect(injectJavaScript).toHaveBeenCalled());

    expect(mockedTranslateParagraphs).toHaveBeenCalledTimes(1);
    expect(mockedUpsertChapterTranslation).toHaveBeenCalled();
    const payload = payloadOf(injectJavaScript.mock.calls[0][0] as string);
    expect(payload?.translations).toEqual(['Fresh text']);
  });

  it('surfaces provider failures as a toast', async () => {
    mockedGetChapterTranslation.mockResolvedValue(null);
    mockedTranslateParagraphs.mockRejectedValue(new Error('network'));
    const { result, injectJavaScript } = setup();

    result.current.onTranslationRequest(['Hello world']);
    await waitFor(() => expect(mockedShowToast).toHaveBeenCalled());

    expect(mockedGetString).toHaveBeenCalledWith(
      'readerScreen.translationError',
    );
    expect(injectJavaScript).not.toHaveBeenCalled();
  });
});
