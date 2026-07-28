import { TEST_PHRASE, testProvider } from '../testProvider';
import { getTranslationProvider } from '../providers';
import { getApiKey } from '../secureStorage';
import { TranslationError, type TranslationConfig } from '../types';

jest.mock('../providers', () => ({ getTranslationProvider: jest.fn() }));
jest.mock('../secureStorage', () => ({ getApiKey: jest.fn() }));

const mockedGetProvider = getTranslationProvider as jest.MockedFunction<
  typeof getTranslationProvider
>;
const mockedGetApiKey = getApiKey as jest.MockedFunction<typeof getApiKey>;

const config = {
  provider: 'libretranslate',
  endpoint: 'https://example.test',
  requiresApiKey: false,
} as TranslationConfig;

const install = (translateBatch: jest.Mock, requiresApiKey = false) => {
  mockedGetProvider.mockReturnValue({
    id: 'libretranslate',
    isLocal: false,
    requiresApiKey: () => requiresApiKey,
    defaultConfig: config,
    translateBatch,
  } as unknown as ReturnType<typeof getTranslationProvider>);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetApiKey.mockResolvedValue(undefined);
});

describe('testProvider', () => {
  it('reports the translated sample on success', async () => {
    install(jest.fn(async () => ['Bonjour le monde.']));

    await expect(testProvider(config, 'fr')).resolves.toEqual({
      ok: true,
      translated: 'Bonjour le monde.',
    });
  });

  it('exercises the same translateBatch path a real translation uses', async () => {
    const batch = jest.fn(async () => ['ok']);
    install(batch);

    await testProvider(config, 'ja', 'ko');

    expect(batch).toHaveBeenCalledWith(
      [TEST_PHRASE],
      expect.objectContaining({ targetLang: 'ja', sourceLang: 'ko' }),
    );
  });

  it('fails without calling the provider when a required key is missing', async () => {
    const batch = jest.fn();
    install(batch, true);

    await expect(testProvider(config, 'fr')).resolves.toMatchObject({
      ok: false,
      kind: 'auth',
    });
    expect(batch).not.toHaveBeenCalled();
  });

  it('passes the stored key through when one exists', async () => {
    const batch = jest.fn(async () => ['ok']);
    install(batch, true);
    mockedGetApiKey.mockResolvedValue('secret');

    await expect(testProvider(config, 'fr')).resolves.toMatchObject({
      ok: true,
    });
    expect(batch).toHaveBeenCalledWith(
      [TEST_PHRASE],
      expect.objectContaining({ apiKey: 'secret' }),
    );
  });

  it('reports a provider failure with its error kind rather than throwing', async () => {
    install(
      jest.fn(async () => {
        throw new TranslationError('rate-limit', 'slow down');
      }),
    );

    await expect(testProvider(config, 'fr')).resolves.toEqual({
      ok: false,
      kind: 'rate-limit',
      message: 'slow down',
    });
  });

  it('reports a non-TranslationError as a network failure', async () => {
    install(
      jest.fn(async () => {
        throw new Error('socket closed');
      }),
    );

    await expect(testProvider(config, 'fr')).resolves.toMatchObject({
      ok: false,
      kind: 'network',
      message: 'socket closed',
    });
  });

  it('treats an empty translation as a failure', async () => {
    install(jest.fn(async () => ['']));

    await expect(testProvider(config, 'fr')).resolves.toMatchObject({
      ok: false,
      kind: 'bad-response',
    });
  });

  it('reports an unreadable secure store as a config problem', async () => {
    install(jest.fn(async () => ['ok']));
    mockedGetApiKey.mockRejectedValue(new Error('keystore down'));

    await expect(testProvider(config, 'fr')).resolves.toMatchObject({
      ok: false,
      kind: 'config',
    });
  });
});
