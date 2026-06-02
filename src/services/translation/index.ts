import { GtxProvider } from './providers/gtx';
import { GoogleProvider } from './providers/google';
import { DeepLProvider } from './providers/deepl';
import { MicrosoftProvider } from './providers/microsoft';
import { extractParagraphs } from './htmlUtils';
import { TranslationProvider, TranslationConfig, ProviderId } from './types';

export type { ProviderId, TranslationConfig };

export const PROVIDERS: Record<ProviderId, TranslationProvider> = {
  gtx: GtxProvider,
  google: GoogleProvider,
  deepl: DeepLProvider,
  microsoft: MicrosoftProvider,
};

export async function translateChapterContent(
  html: string,
  targetLang: string,
  config: TranslationConfig,
  apiKey: string,
): Promise<string> {
  const provider = PROVIDERS[config.provider];
  const { texts, rebuild } = extractParagraphs(html);
  if (!texts.length) return html;
  const translated = await provider.translateBatch(texts, targetLang, config, apiKey);
  return rebuild(translated);
}
