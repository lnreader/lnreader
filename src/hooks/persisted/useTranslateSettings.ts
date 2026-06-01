import { useMMKVObject } from 'react-native-mmkv';
import { ProviderId } from '@services/translate/types';
import {
  getSecureString,
  setSecureString,
  deleteSecureString,
} from '@utils/mmkv/mmkv';

export const TRANSLATE_SETTINGS = 'TRANSLATE_SETTINGS';

export interface TranslateSettings {
  translateEnabled: boolean;
  translateMode: 'translated' | 'dual';
  translateTargetLanguage: string;
  translateColor: string;
  translateItalic: boolean;
  translateUnderline: boolean;
  translateProvider: ProviderId;
  deeplPlan: 'free' | 'pro';
  microsoftRegion: string;
}

export const initialTranslateSettings: TranslateSettings = {
  translateEnabled: false,
  translateMode: 'dual',
  translateTargetLanguage: 'es',
  translateColor: '#6b7280',
  translateItalic: true,
  translateUnderline: false,
  translateProvider: 'gtx',
  deeplPlan: 'free',
  microsoftRegion: 'eastus',
};

// Secure API key storage keys — one per provider that requires a key
const API_KEY_PREFIX = 'TRANSLATE_API_KEY_';

export const getProviderApiKey = (providerId: ProviderId): string => {
  return getSecureString(`${API_KEY_PREFIX}${providerId}`) ?? '';
};

export const setProviderApiKey = (
  providerId: ProviderId,
  key: string,
): void => {
  if (key.trim().length === 0) {
    deleteSecureString(`${API_KEY_PREFIX}${providerId}`);
  } else {
    setSecureString(`${API_KEY_PREFIX}${providerId}`, key.trim());
  }
};

export const useTranslateSettings = () => {
  const [translateSettings = initialTranslateSettings, setSettings] =
    useMMKVObject<TranslateSettings>(TRANSLATE_SETTINGS);

  const setTranslateSettings = (values: Partial<TranslateSettings>) =>
    setSettings({ ...translateSettings, ...values });

  return {
    ...translateSettings,
    setTranslateSettings,
  };
};
