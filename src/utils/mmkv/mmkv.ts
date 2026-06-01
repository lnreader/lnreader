import { createMMKV } from 'react-native-mmkv';

export const MMKVStorage = createMMKV();
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

// --- Secure MMKV for API keys ---
// NOTE: The encryption key is generated once and stored in regular MMKV.
// A proper implementation should use the OS keychain.
const SECURE_KEY_STORAGE_KEY = 'SECURE_MMKV_ENCRYPTION_KEY';

function getOrCreateEncryptionKey(): string {
  let key = MMKVStorage.getString(SECURE_KEY_STORAGE_KEY);
  if (!key) {
    // Generate a random UUID-like key
    key = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.floor(Math.random() * 16);
      const v = c === 'x' ? r : (r % 4) + 8;
      return v.toString(16);
    });
    MMKVStorage.set(SECURE_KEY_STORAGE_KEY, key);
  }
  return key;
}

let _secureMMKV: ReturnType<typeof createMMKV> | null = null;

function getSecureMMKV() {
  if (!_secureMMKV) {
    _secureMMKV = createMMKV({
      id: 'secure-api-keys',
      encryptionKey: getOrCreateEncryptionKey(),
    });
  }
  return _secureMMKV;
}

export function getSecureString(key: string): string | undefined {
  return getSecureMMKV().getString(key);
}

export function setSecureString(key: string, value: string): void {
  getSecureMMKV().set(key, value);
}

export function deleteSecureString(key: string): void {
  getSecureMMKV().remove(key);
}
