import { useState, useCallback } from 'react';
import { SecureMMKVStorage } from '@utils/mmkv/mmkv';

export interface SecureKeys {
  googleApiKey: string;
  deeplApiKey: string;
  microsoftApiKey: string;
}

export const useSecureKeys = () => {
  const [keys, setKeysState] = useState<SecureKeys>(() => ({
    googleApiKey: SecureMMKVStorage.getString('googleApiKey') || '',
    deeplApiKey: SecureMMKVStorage.getString('deeplApiKey') || '',
    microsoftApiKey: SecureMMKVStorage.getString('microsoftApiKey') || '',
  }));

  const setSecureKeys = useCallback((values: Partial<SecureKeys>) => {
    setKeysState(prev => {
      const next = { ...prev, ...values };
      if (values.googleApiKey !== undefined) {
        SecureMMKVStorage.set('googleApiKey', values.googleApiKey);
      }
      if (values.deeplApiKey !== undefined) {
        SecureMMKVStorage.set('deeplApiKey', values.deeplApiKey);
      }
      if (values.microsoftApiKey !== undefined) {
        SecureMMKVStorage.set('microsoftApiKey', values.microsoftApiKey);
      }
      return next;
    });
  }, []);

  return {
    ...keys,
    setSecureKeys,
  };
};
