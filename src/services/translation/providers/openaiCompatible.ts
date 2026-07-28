/**
 * OpenAI, DeepSeek, NVIDIA NIM and HuggingFace.
 *
 * All four expose the same `/chat/completions` contract, so they share one
 * implementation and differ only in default endpoint and model. Keeping them
 * as distinct provider ids (rather than one "OpenAI-compatible" entry with a
 * URL field) matters because each needs its own API key in the encrypted
 * store, and the settings screen only ever asks for the active provider's key.
 */
import {
  TranslationError,
  type OpenAICompatibleConfig,
  type TranslationProvider,
  type TranslationProviderId,
} from '../types';
import { postJson, trimTrailingSlash } from './http';
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT_TEMPLATE,
  encodeBatch,
  fillPromptTemplate,
  parseJsonArrayResponse,
} from './llm';

interface ChatCompletionResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  error?: { message?: string };
}

type OpenAICompatibleId = OpenAICompatibleConfig['provider'];

const createOpenAICompatibleProvider = (
  id: OpenAICompatibleId,
  label: string,
  defaults: { endpoint: string; model: string },
): TranslationProvider<OpenAICompatibleConfig> => ({
  id: id as TranslationProviderId & OpenAICompatibleId,
  isLocal: false,
  requiresApiKey: () => true,
  defaultConfig: {
    provider: id,
    endpoint: defaults.endpoint,
    model: defaults.model,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
  },
  translateBatch: async (texts, ctx) => {
    const { config, apiKey, sourceLang, targetLang, signal } = ctx;

    if (!apiKey) {
      throw new TranslationError('auth', `A ${label} API key is required.`);
    }

    const prompt = fillPromptTemplate(config.userPromptTemplate, {
      sourceLang,
      targetLang,
      text: encodeBatch(texts),
    });

    const body = await postJson<ChatCompletionResponse>(
      `${trimTrailingSlash(config.endpoint)}/chat/completions`,
      {
        model: config.model,
        messages: [
          { role: 'system', content: config.systemPrompt },
          { role: 'user', content: prompt },
        ],
        // Constrains decoding to JSON where supported; providers that don't
        // recognise it ignore it, and `parseJsonArrayResponse` still strips
        // any code fence the model emits.
        response_format: { type: 'json_object' },
        stream: false,
      },
      { headers: { Authorization: `Bearer ${apiKey}` }, signal },
    );

    if (body.error?.message) {
      throw new TranslationError(
        'bad-response',
        `${label} error: ${body.error.message}`,
      );
    }

    const choice = body.choices?.[0];
    const content = choice?.message?.content;

    if (!content) {
      throw new TranslationError(
        'bad-response',
        choice?.finish_reason
          ? `${label} returned no content (finish reason: ${choice.finish_reason}).`
          : `${label} returned no content.`,
      );
    }

    return parseJsonArrayResponse(content, texts.length, label);
  },
});

export const openAIProvider = createOpenAICompatibleProvider(
  'openai',
  'OpenAI',
  { endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
);

export const deepSeekProvider = createOpenAICompatibleProvider(
  'deepseek',
  'DeepSeek',
  { endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
);

export const nvidiaNimProvider = createOpenAICompatibleProvider(
  'nvidianim',
  'NVIDIA NIM',
  {
    endpoint: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.1-8b-instruct',
  },
);

export const huggingFaceProvider = createOpenAICompatibleProvider(
  'huggingface',
  'HuggingFace',
  {
    endpoint: 'https://router.huggingface.co/v1',
    model: 'meta-llama/Llama-3.1-8B-Instruct',
  },
);
