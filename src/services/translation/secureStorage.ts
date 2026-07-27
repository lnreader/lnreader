/**
 * Encrypted storage for translation provider API keys.
 *
 * Spec constraint (`docs/specs/chapter-translation.md` §7): keys must never sit
 * in the regular settings store, and the encryption key must be generated at
 * runtime rather than hardcoded.
 *
 * Layout:
 * - A 32-character random key is generated on first use via `expo-crypto` and
 *   held in `expo-secure-store`, which is backed by the Android Keystore.
 * - That key encrypts a dedicated MMKV instance (AES-256) holding the actual
 *   provider secrets. The regular `MMKVStorage` instance never sees them.
 *
 * The chicken-and-egg (SecureStore is async, MMKV construction is sync) is
 * resolved by making the whole store lazily async behind a cached promise.
 * Every caller here is already on an async path, so this costs nothing.
 */
import { createMMKV } from 'react-native-mmkv';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { TranslationError, type TranslationProviderId } from './types';

/** Keystore entry holding the MMKV encryption key. */
const ENCRYPTION_KEY_ALIAS = 'lnreader.translation.encryptionKey';
/** MMKV instance id. Separate file from the app's default instance. */
const SECURE_STORE_ID = 'lnreader-translation-secrets';

/**
 * MMKV caps encryption keys at 32 bytes for AES-256. Drawing 32 random bytes
 * and base64-ing them would yield 44 characters and overflow that, so bytes
 * are mapped onto a 64-character alphabet instead: 32 characters carrying
 * 6 bits each. 256 is a multiple of 64, so `% 64` introduces no modulo bias.
 */
const KEY_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const KEY_LENGTH = 32;

const generateEncryptionKey = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(KEY_LENGTH);
  let key = '';
  for (let i = 0; i < bytes.length; i++) {
    key += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
  }
  return key;
};

const loadOrCreateEncryptionKey = async (): Promise<string> => {
  if (!(await SecureStore.isAvailableAsync())) {
    // Falling back to an unencrypted store here would silently defeat the
    // point of the feature, so this is fatal rather than degraded.
    throw new TranslationError(
      'config',
      'Secure storage is unavailable on this device, so provider API keys cannot be stored safely.',
    );
  }

  const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_ALIAS);
  if (existing) {
    return existing;
  }

  const created = await generateEncryptionKey();
  await SecureStore.setItemAsync(ENCRYPTION_KEY_ALIAS, created);
  return created;
};

type SecretStore = ReturnType<typeof createMMKV>;

let storePromise: SecretStore | Promise<SecretStore> | undefined;

const getStore = (): SecretStore | Promise<SecretStore> => {
  if (storePromise) {
    return storePromise;
  }
  const pending = loadOrCreateEncryptionKey().then(encryptionKey => {
    const store = createMMKV({
      id: SECURE_STORE_ID,
      encryptionKey,
      encryptionType: 'AES-256',
    });
    // Collapse to the resolved instance so subsequent calls skip the
    // microtask and the Keystore round trip entirely.
    storePromise = store;
    return store;
  });
  // A failed init must not be cached, otherwise a transient Keystore error
  // would poison the store for the rest of the process lifetime.
  pending.catch(() => {
    storePromise = undefined;
  });
  storePromise = pending;
  return pending;
};

const secretKey = (providerId: TranslationProviderId) => `apiKey.${providerId}`;

export const getApiKey = async (
  providerId: TranslationProviderId,
): Promise<string | undefined> => {
  const store = await getStore();
  return store.getString(secretKey(providerId)) || undefined;
};

export const setApiKey = async (
  providerId: TranslationProviderId,
  apiKey: string,
): Promise<void> => {
  const store = await getStore();
  const trimmed = apiKey.trim();
  if (trimmed) {
    store.set(secretKey(providerId), trimmed);
  } else {
    store.remove(secretKey(providerId));
  }
};

export const deleteApiKey = async (
  providerId: TranslationProviderId,
): Promise<void> => {
  const store = await getStore();
  store.remove(secretKey(providerId));
};

export const hasApiKey = async (
  providerId: TranslationProviderId,
): Promise<boolean> => {
  const store = await getStore();
  return store.contains(secretKey(providerId));
};

/** Test seam. Drops the cached instance so the next call re-reads the key. */
export const __resetSecureStoreForTests = () => {
  storePromise = undefined;
};
