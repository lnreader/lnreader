/**
 * Provider registry.
 *
 * Adding a provider means writing the module and adding one line here;
 * nothing outside this directory switches on provider identity.
 */
import type {
  TranslationConfig,
  TranslationProvider,
  TranslationProviderId,
} from '../types';
import { libreTranslateProvider } from './libretranslate';
import { geminiProvider } from './gemini';
import { ollamaProvider } from './ollama';
import {
  deepSeekProvider,
  huggingFaceProvider,
  nvidiaNimProvider,
  openAIProvider,
} from './openaiCompatible';
import { microsoftProvider } from './microsoft';
import { systranProvider } from './systran';
import { customHttpProvider } from './customHttp';

const registry = {
  libretranslate: libreTranslateProvider,
  gemini: geminiProvider,
  ollama: ollamaProvider,
  openai: openAIProvider,
  deepseek: deepSeekProvider,
  nvidianim: nvidiaNimProvider,
  huggingface: huggingFaceProvider,
  microsoft: microsoftProvider,
  systran: systranProvider,
  customhttp: customHttpProvider,
} as const;

/**
 * Registry entries are typed against their own config member, which no single
 * `TranslationProvider<TranslationConfig>` signature can express (the config
 * parameter is contravariant). Call sites always pair a provider with the
 * config drawn from the same discriminated union, so the cast is sound; it is
 * confined to this accessor rather than leaking to consumers.
 */
export const getTranslationProvider = (
  id: TranslationProviderId,
): TranslationProvider<TranslationConfig> =>
  registry[id] as unknown as TranslationProvider<TranslationConfig>;

export const TRANSLATION_PROVIDER_IDS = Object.keys(
  registry,
) as TranslationProviderId[];

export const getDefaultConfig = (
  id: TranslationProviderId,
): TranslationConfig => registry[id].defaultConfig;

export const isLocalProvider = (id: TranslationProviderId): boolean =>
  registry[id].isLocal;

export {
  DEFAULT_LIBRETRANSLATE_ENDPOINT,
  libreTranslateProvider,
} from './libretranslate';
export { DEFAULT_GEMINI_MODEL, geminiProvider } from './gemini';
export {
  DEFAULT_OLLAMA_ENDPOINT,
  DEFAULT_OLLAMA_MODEL,
  ollamaProvider,
} from './ollama';
export {
  deepSeekProvider,
  huggingFaceProvider,
  nvidiaNimProvider,
  openAIProvider,
} from './openaiCompatible';
export { DEFAULT_MICROSOFT_ENDPOINT, microsoftProvider } from './microsoft';
export { DEFAULT_SYSTRAN_ENDPOINT, systranProvider } from './systran';
export {
  customHttpProvider,
  fillHttpTemplate,
  languageDisplayName,
  resolveJsonPath,
} from './customHttp';
export { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE } from './llm';
