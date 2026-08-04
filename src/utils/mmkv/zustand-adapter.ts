import { MMKVStorage } from './mmkv';
import { logger } from '@utils/logger/logger';

/**
 * Zustand persist storage adapter for MMKV.
 * Implements the storage contract required by zustand's persist middleware.
 *
 * This adapter bridges zustand's storage interface (getItem, setItem, removeItem)
 * with the MMKV native storage backend used in react-native-mmkv.
 */
export const mmkvZustandAdapter = {
  /**
   * Get a stored value from MMKV by key.
   * Returns JSON string for zustand to parse, or null if not found.
   */
  getItem: (key: string): string | null => {
    try {
      const value = MMKVStorage.getString(key);
      return value ?? null;
    } catch (error) {
      logger.error(
        'mmkvZustandAdapter',
        `Error getting item for key "${key}"`,
        error,
      );
      return null;
    }
  },

  /**
   * Set a value in MMKV storage.
   * Zustand passes a JSON string; we store it directly.
   */
  setItem: (key: string, value: string): void => {
    try {
      MMKVStorage.set(key, value);
    } catch (error) {
      logger.error(
        'mmkvZustandAdapter',
        `Error setting item for key "${key}"`,
        error,
      );
    }
  },

  /**
   * Remove a value from MMKV storage.
   */
  removeItem: (key: string): void => {
    try {
      MMKVStorage.remove(key);
    } catch (error) {
      logger.error(
        'mmkvZustandAdapter',
        `Error removing item for key "${key}"`,
        error,
      );
    }
  },
};
