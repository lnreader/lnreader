import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createMMKV, MMKV } from 'react-native-mmkv';

export const MMKVStorage = createMMKV();

const KEYCHAIN_KEY = 'lnreader.mmkv.encryptionKey';
let _secureMMKV: MMKV | null = null;

export async function initSecureStorage(): Promise<void> {
  let encryptionKey = await SecureStore.getItemAsync(KEYCHAIN_KEY);
  if (!encryptionKey) {
    encryptionKey = Crypto.randomUUID();
    await SecureStore.setItemAsync(KEYCHAIN_KEY, encryptionKey);
  }
  _secureMMKV = createMMKV({ id: 'secure-api-keys', encryptionKey });
}

export function getSecureMMKV(): MMKV {
  if (!_secureMMKV) {
    throw new Error('Secure storage not initialized. Call initSecureStorage() first.');
  }
  return _secureMMKV;
}

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
  return getSecureMMKV().getString(key) || '';
}

export function setSecureKey(key: string, value: string): void {
  getSecureMMKV().set(key, value);
}
