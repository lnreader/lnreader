import { useCallback } from 'react';
import { useMMKVString } from 'react-native-mmkv';
import { getSecureMMKV } from '@utils/mmkv/mmkv';

export interface SecureKeys {
  googleApiKey: string;
  deeplApiKey: string;
  microsoftApiKey: string;
}

export const useSecureKeys = () => {
  const [googleApiKey = '', setGoogleApiKey] = useMMKVString(
    'googleApiKey',
    getSecureMMKV(),
  );
  const [deeplApiKey = '', setDeeplApiKey] = useMMKVString(
    'deeplApiKey',
    getSecureMMKV(),
  );
  const [microsoftApiKey = '', setMicrosoftApiKey] = useMMKVString(
    'microsoftApiKey',
    getSecureMMKV(),
  );

  const setSecureKeys = useCallback(
    (values: Partial<SecureKeys>) => {
      if (values.googleApiKey !== undefined) setGoogleApiKey(values.googleApiKey);
      if (values.deeplApiKey !== undefined) setDeeplApiKey(values.deeplApiKey);
      if (values.microsoftApiKey !== undefined)
        setMicrosoftApiKey(values.microsoftApiKey);
    },
    [setGoogleApiKey, setDeeplApiKey, setMicrosoftApiKey],
  );

  return {
    googleApiKey,
    deeplApiKey,
    microsoftApiKey,
    setSecureKeys,
  };
};
