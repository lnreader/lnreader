# State: LNReader - Piper TTS

**Last updated:** 2026-02-27

## Project Reference

**Core Value:** Users can read light novels from multiple sources with offline support and text-to-speech.

**Current Focus:** Roadmap creation - deriving phases from requirements

## Current Position

| Attribute | Value        |
| --------- | ------------ |
| Phase     | Planning     |
| Plan      | 0/3 complete |
| Status    | In progress  |
| Progress  | ░░░░░░░░░ 0% |

## Requirements Status

**v1 Requirements:** 9 total

- Core Playback: 4 requirements
- Platform Integration: 3 requirements
- Integration: 2 requirements

## Phase Summary

| Phase                   | Goal                                                  | Requirements                   | Status  |
| ----------------------- | ----------------------------------------------------- | ------------------------------ | ------- |
| 1 - Core TTS Engine     | TTS Engine abstraction, Model Manager, basic playback | TTS-01, TTS-07, TTS-08         | Pending |
| 2 - Background Playback | Audio session config, lock screen controls            | TTS-02, TTS-05                 | Pending |
| 3 - Reader Integration  | Speed control, position sync, chapter navigation      | TTS-03, TTS-04, TTS-06, TTS-09 | Pending |

## Research Context

**Key findings:**

- Use `react-native-sherpa-onnx` v0.2.0 for offline TTS
- Architecture: Strategy Pattern with TTS Engine Abstraction
- Critical pitfalls: Audio session conflicts, ONNX model loading on iOS, UI thread blocking
- Recommended: Phase structure matches research suggestions

## Decisions Made

| Decision                     | Rationale                                             |
| ---------------------------- | ----------------------------------------------------- |
| 3-phase structure            | Matches natural delivery boundaries from requirements |
| Phase 1 = Engine/Model       | Foundation all other features depend on               |
| Phase 2 = Background         | Critical for novel reading use case                   |
| Phase 3 = Reader Integration | Connects TTS to existing reader components            |

## Accumulated Context

### Architecture Notes

- TTS Engine Abstraction using Strategy Pattern
- Model Manager for voice downloads (Documents directory)
- Reuse existing NativeTTSMediaControl for lock screen

### Technical Considerations

- Must handle iOS audio session conflicts with AVSpeechSynthesizer
- Models go to Documents (not bundle) for iOS sandbox
- Chunk text to avoid UI thread blocking

## Session Continuity

**Next step:** `/gsd-plan-phase 1` to create detailed plan for Phase 1

---

_Last updated: 2026-02-27_
