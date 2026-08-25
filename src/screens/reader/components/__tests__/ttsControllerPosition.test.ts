import { MMKVStorage } from '@utils/mmkv/mmkv';
import { TTS_CONTROLLER_POSITION } from '@hooks/persisted/useSettings';
import {
  getSavedTtsControllerPosition,
  parseTtsControllerPosition,
  saveTtsControllerPosition,
} from '../ttsControllerPosition';

describe('ttsControllerPosition', () => {
  beforeEach(() => {
    MMKVStorage.clearAll();
  });

  describe('parseTtsControllerPosition', () => {
    it('accepts a valid { left, top } payload', () => {
      expect(parseTtsControllerPosition({ left: 100, top: 200 })).toEqual({
        left: 100,
        top: 200,
      });
    });

    it('allows unknown extra keys', () => {
      expect(
        parseTtsControllerPosition({ left: 10, top: 20, extra: 'ignored' }),
      ).toEqual({ left: 10, top: 20 });
    });

    it.each([
      ['null', null],
      ['a string', 'x'],
      ['an empty object', {}],
      ['string left', { left: '1', top: 10 }],
      ['NaN left', { left: NaN, top: 10 }],
      ['missing left', { top: 1 }],
      ['undefined top', { left: 1, top: undefined }],
    ])('rejects %s', (_name, data) => {
      expect(parseTtsControllerPosition(data)).toBeNull();
    });
  });

  describe('save/get round trip', () => {
    it('persists { left, top } under TTS_CONTROLLER_POSITION', () => {
      saveTtsControllerPosition({ left: 120, top: 640 });

      expect(MMKVStorage.contains(TTS_CONTROLLER_POSITION)).toBe(true);
      expect(getSavedTtsControllerPosition()).toEqual({ left: 120, top: 640 });
    });

    it('returns null (not undefined) when the key is absent', () => {
      expect(getSavedTtsControllerPosition()).toBeNull();
    });

    it('returns null instead of throwing on corrupt stored data', () => {
      // getMMKVObject JSON.parse throws on malformed values; a cosmetic
      // position read must never break the reader's per-chapter build.
      MMKVStorage.set(TTS_CONTROLLER_POSITION, '{not-json');

      expect(getSavedTtsControllerPosition()).toBeNull();
    });
  });
});
