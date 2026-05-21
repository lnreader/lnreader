import { GtxProvider } from './providers/gtx';
import { GoogleProvider } from './providers/google';
import { DeepLProvider } from './providers/deepl';
import { MicrosoftProvider } from './providers/microsoft';
import { extractParagraphs } from './htmlUtils';
import { TranslationProvider, ProviderConfig, ProviderId } from './types';

export type { ProviderId, ProviderConfig };

export const PROVIDERS: Record<ProviderId, TranslationProvider> = {
  gtx: GtxProvider,
  google: GoogleProvider,
  deepl: DeepLProvider,
  microsoft: MicrosoftProvider,
};

export async function translateChapterContent(
  html: string,
  targetLang: string,
  providerId: ProviderId,
  config: ProviderConfig,
): Promise<string> {
  const provider = PROVIDERS[providerId];
  const { texts, rebuild } = extractParagraphs(html);
  if (!texts.length) return html;
  const translated = await provider.translateBatch(texts, targetLang, config);
  return rebuild(translated);
}
