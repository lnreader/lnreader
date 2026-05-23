import { createMMKV } from 'react-native-mmkv';

export const MMKVStorage = createMMKV();
export const SecureMMKVStorage = createMMKV({
  id: 'secure-api-keys',
  encryptionKey: 'lnreader-secure-encryption-key-for-api-keys',
});

export function getMMKVObject<T>(key: string) {
  const data = MMKVStorage.getString(key);
  if (data) {
    return JSON.parse(data) as T;
  }
  return undefined;
}

export function setMMKVObject<T>(key: string, obj: T) {
  MMKVStorage.set(key, JSON.stringify(obj));
}

export function getSecureKey(key: string): string {
  return SecureMMKVStorage.getString(key) || '';
}

export function setSecureKey(key: string, value: string): void {
  SecureMMKVStorage.set(key, value);
}

