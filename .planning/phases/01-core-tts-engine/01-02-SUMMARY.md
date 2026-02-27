---
phase: 01-core-tts-engine
plan: 02
subsystem: tts
tags: [tts, voice-models, player-controller, piper, sherpa-onnx]

# Dependency graph
requires:
  - phase: 01-core-tts-engine
    provides: TTS Engine abstraction (01-01)
provides:
  - ModelManager for voice model lifecycle management
  - VoiceManager for voice enumeration and selection
  - PlayerController for unified playback controls
affects: [02-background-playback, 03-reader-integration]

# Tech tracking
tech-stack:
  added: [react-native-fs, react-native-zip-archive, @react-native-async-storage/async-storage]
  patterns: [Singleton pattern for player instance, Strategy Pattern for TTS engines]

key-files:
  created:
    - src/tts/manager/ModelManager.ts - Voice model lifecycle (download/extract/delete/verify)
    - src/tts/manager/VoiceManager.ts - Voice enumeration and selection (20+ Piper voices)
    - src/tts/PlayerController.ts - Unified play/pause/stop/speed/voice API
    - src/tts/index.ts - Public API exports with getTTSPlayer() singleton

key-decisions:
  - "Used AsyncStorage for persisting selected voice preference"
  - "Implemented auto-fallback from offline to native TTS on initialization failure"
  - "Hardcoded 20 Piper voices from rhasspy/piper-voices project"

patterns-established:
  - "PlayerController wraps TTSEngine interface for unified API"
  - "ModelManager stores models in Documents/voices/{modelId}/"

requirements-completed: [TTS-01, TTS-07]

# Metrics
duration: 3 min
completed: 2026-02-27T11:44:42Z
---

# Phase 1 Plan 2: Model Manager & Player Controller Summary

**ModelManager for voice downloads with progress tracking, VoiceManager for voice enumeration, and PlayerController providing unified play/pause/stop controls**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T11:41:07Z
- **Completed:** 2026-02-27T11:44:42Z
- **Tasks:** 4
- **Files modified:** 4 (all created)

## Accomplishments

- Created ModelManager for voice model lifecycle (download, extract, delete, verify)
- Created VoiceManager with 20+ Piper voices and AsyncStorage persistence
- Created PlayerController with unified play/pause/stop/speed/voice API
- Exported public TTS module API from single entry point with getTTSPlayer() singleton

## task Commits

1. **task 1-4: TTS Manager Implementation** - `aaf73951` (feat)
   - ModelManager class
   - VoiceManager class
   - PlayerController class
   - TTS module exports

**Plan metadata:** `aaf73951` (docs: complete plan)

## Files Created/Modified

- `src/tts/manager/ModelManager.ts` - Voice model lifecycle management
- `src/tts/manager/VoiceManager.ts` - Voice enumeration and selection
- `src/tts/PlayerController.ts` - Unified playback controls
- `src/tts/index.ts` - Public API exports

## Decisions Made

- Used AsyncStorage for persisting selected voice preference (key: tts_selected_voice)
- Implemented auto-fallback from offline to native TTS on initialization failure
- Models stored at Documents/voices/{modelId}/

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 foundation complete (engine abstraction + model management + playback controls)
- Ready for Phase 2: Background playback with audio session and lock screen controls

---

_Phase: 01-core-tts-engine_
_Completed: 2026-02-27_
