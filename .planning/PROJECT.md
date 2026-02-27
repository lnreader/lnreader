# LNReader

## What This Is

LNReader is an Android/iOS novel reader app that lets users read light novels from various online sources. Users can follow novels, track reading progress, and listen to text-to-speech.

## Core Value

Users can read light novels from multiple sources with offline support and text-to-speech playback.

## Requirements

### Validated

- ✓ Novel reading from online sources — existing
- ✓ Library management (follow/unfollow novels) — existing
- ✓ Chapter tracking and progress sync — existing
- ✓ TTS playback using native iOS voices — existing
- ✓ Offline chapter downloads — existing

### Active

- [ ] **Piper TTS Engine** — Add offline text-to-speech using Piper/Sherpa-ONNX for higher quality natural voices

### Out of Scope

- Audiobook player (TTS is for reading assistance)
- Multiple voice selection per language (future enhancement)
- Cloud sync of TTS settings

## Context

- Existing TTS uses native iOS AVSpeechSynthesizer
- Adding offline TTS with better voice quality via Piper ONNX models
- Reference: https://github.com/kislay99/react-native-sherpa-onnx-offline-tts

## Constraints

- **Platform**: iOS (primary), Android (if feasible)
- **Offline**: TTS should work without network
- **Performance**: Must not block UI thread
- **Storage**: Voice models should be downloadable

## Key Decisions

| Decision                          | Rationale                                     | Outcome   |
| --------------------------------- | --------------------------------------------- | --------- |
| Use Sherpa-ONNX/Piper             | Offline TTS with natural voices               | — Pending |
| Separate engine from existing TTS | Allow user to choose between native and Piper | — Pending |

---

_Last updated: 2026-02-27 after feature request_
