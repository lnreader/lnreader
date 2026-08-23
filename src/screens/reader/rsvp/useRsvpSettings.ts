/**
 * useRsvpSettings — MMKV-persisted RSVP settings (spec-1576 R4/AC5).
 *
 * Contract: useMMKVObject-backed hook returning {rsvpSettings, setRsvp}
 * where rsvpSettings is always a complete RsvpSettings object — defaults
 * {wpm: 250, chunkSize: 1} fill missing fields; wpm is clamped to
 * [150, 800]; chunkSize is clamped to [1, 3] integers.
 */

import { useMMKVObject } from 'react-native-mmkv';

import { useCallback, useEffect, useRef } from 'react';

import { RSVP_SETTINGS } from './constants';

export interface RsvpSettings {
  wpm: number;
  chunkSize: number;
}

export const RSVP_WPM_BOUNDS = { min: 150, max: 800 } as const;
export const RSVP_CHUNK_SIZES = [1, 2, 3] as const;

const DEFAULTS: RsvpSettings = { wpm: 250, chunkSize: 1 };

const clampInt = (value: unknown, min: number, max: number): number => {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, Math.round(num)));
};

const normalize = (raw: Partial<RsvpSettings> | undefined): RsvpSettings => ({
  wpm: clampInt(
    raw?.wpm ?? DEFAULTS.wpm,
    RSVP_WPM_BOUNDS.min,
    RSVP_WPM_BOUNDS.max,
  ),
  chunkSize: clampInt(raw?.chunkSize ?? DEFAULTS.chunkSize, 1, 3),
});

export const useRsvpSettings = (): {
  rsvpSettings: RsvpSettings;
  setRsvp: (patch: Partial<RsvpSettings>) => void;
} => {
  const [stored, setStored] =
    useMMKVObject<Partial<RsvpSettings>>(RSVP_SETTINGS);

  // Merge reads the LATEST stored value via a ref so back-to-back patches
  // compose even when the MMKV subscription has not re-rendered yet
  // (stale-closure guard). The ref write lives in an effect, not render,
  // per react-hooks/exhaustive-deps + refs-during-render lint rules.
  const storedRef = useRef(stored);
  useEffect(() => {
    storedRef.current = stored;
  }, [stored]);

  // Local state mirrors the normalized object so reads never see partials.
  const rsvpSettings = normalize(stored);

  const setRsvp = useCallback(
    (patch: Partial<RsvpSettings>) => {
      setStored(normalize({ ...normalize(storedRef.current), ...patch }));
    },
    [setStored],
  );

  return { rsvpSettings, setRsvp };
};
