# Project Research Summary

**Project:** LNReader Offline TTS
**Domain:** Offline Text-to-Speech (TTS) for React Native / Expo Mobile App
**Researched:** 2026-02-27
**Confidence:** HIGH

## Executive Summary

This research addresses adding offline Text-to-Speech (TTS) capabilities to LNReader using Piper/Sherpa-ONNX voice models. The recommended approach uses `react-native-sherpa-onnx` (v0.2.0) as a TurboModule that provides hardware-accelerated offline TTS with automatic Core ML support on iOS. The architecture introduces a TTS Engine abstraction layer that allows users to switch between native iOS voices (existing expo-speech) and offline Piper voices (new Sherpa-ONNX), sharing the existing NativeTTSMediaControl for notifications and lock screen controls.

Key risks center on iOS audio session coordination (avoiding conflicts with existing AVSpeechSynthesizer), proper model file path handling on iOS sandbox, and maintaining background playback capabilities. These are addressable through careful native module integration and proper iOS audio session configuration. The MVP prioritizes core playback functionality with offline TTS, deferring advanced features like pronunciation dictionaries and text highlighting to later phases.

## Key Findings

### Recommended Stack

The core TTS implementation uses `react-native-sherpa-onnx` v0.2.0 as a TurboModule, providing efficient JS-native communication and automatic hardware acceleration (Core ML on iOS, NNAPI on Android). The underlying `sherpa-onnx` library supports 30+ languages via Piper/VITS models. For model management, use `react-native-fs` for downloads and `react-native-zip-archive` for extraction, storing models in the Documents directory to avoid iOS sandbox issues.

**Core technologies:**

- **react-native-sherpa-onnx v0.2.0** — Offline TTS via Sherpa-ONNX with TurboModule efficiency
- **react-native-fs + react-native-zip-archive** — Model download and extraction lifecycle
- **Piper voice models (vits-piper-en_US-ryan-medium)** — ~50MB English voice, recommended starting model

Requires Expo SDK 52+ with CNG workflow (`npx expo prebuild`), React Native >= 0.70, iOS 13.0+, and Android API 24+.

### Expected Features

**Must have (table stakes):**

- Play/Pause/Stop controls — Essential for any audio feature; immediate access via UI and notifications
- Background playback — Users listen while doing other tasks or with screen off; requires iOS audio session configuration
- Continue from current position — TTS must pick up where user left off, syncing with reader position
- Speed control (0.5x - 2.0x) — Standard expectation across TTS apps
- Lock screen controls — Native media session integration required

**Should have (competitive):**

- Sleep timer — Popular feature in TTS reader apps; prevents battery drain
- Auto-advance chapters — Seamless continuation to next chapter
- Chapter navigation — Navigate via TTS controls for long novels
- Voice selection — Choose between multiple available offline voices

**Defer (v2+):**

- Pronunciation dictionary — Advanced feature for fixing mispronunciations
- Text highlighting — Adds complexity; valuable but not critical
- Bluetooth/headset controls — Most users control via phone
- Multi-language support — Add after validating single-language success

### Architecture Approach

The architecture uses a **Strategy Pattern** with TTS Engine Abstraction, allowing both native (expo-speech) and offline (Sherpa-ONNX) engines to be accessed through a unified interface. The **Model Manager** component handles voice model download, extraction, caching, and lifecycle. The existing **NativeTTSMediaControl** TurboModule is reused for notifications and lock screen controls, avoiding duplicate native code.

**Major components:**

1. **TTS Controller** — Orchestrates playback, manages settings, handles engine selection
2. **TTS Engine Abstraction** — Unified interface (Strategy Pattern) hiding implementation differences
3. **Offline TTS Engine** — Adapter wrapping Sherpa-ONNX for offline playback
4. **Model Manager** — Handles download, extraction, caching of voice models
5. **Voice Selector UI** — UI for engine/voice selection in existing TTSTab

### Critical Pitfalls

1. **Audio Session Conflicts** — iOS audio sessions are exclusive; Sherpa-ONNX can conflict with existing AVSpeechSynthesizer. Prevention: Implement proper audio session category handling, use `.playback` with `.mixWithOthers` option, add reinitialization logic when conflicts detected.

2. **ONNX Model Loading Failures on iOS** — Sandboxed file access causes loading failures. Prevention: Download models to Documents directory (not bundle assets), verify file exists before loading, test on actual device not just simulator.

3. **UI Thread Blocking During Synthesis** — ONNX inference is CPU-intensive; blocks JS thread. Prevention: Chunk long text into smaller segments (paragraphs/sentences), add loading indicators, test on lower-end devices.

4. **App Size Explosion** — Voice models are 20-50MB each; bundling multiplies this. Prevention: Use runtime download (lazy loading), start with single English voice, show download progress.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core TTS Engine Integration

**Rationale:** Establishes the foundation all other features depend on; must work reliably before building UI
**Delivers:** TTS Engine Abstraction with Strategy Pattern, Model Manager for offline voice downloads, basic playback controls (play/pause/stop)
**Addresses:** Features from FEATURES.md — Play/Pause/Stop, Voice Selection
**Avoids:** Pitfall #2 (model loading failures) — build Model Manager first with proper Documents path handling

### Phase 2: Background Playback & Lock Screen

**Rationale:** Critical for novel reading use case; depends on Phase 1 engine working
**Delivers:** iOS audio session configuration for background, lock screen controls, notification integration using existing NativeTTSMediaControl
**Addresses:** Background playback, Lock screen controls, Continue from position
**Avoids:** Pitfall #5 (missing background audio), Pitfall #6 (poor lock screen integration)

### Phase 3: Reader Integration & Settings

**Rationale:** Connects TTS to existing reader components; adds speed control and position sync
**Delivers:** TTS Controller integration with WebViewReader, speed control (0.5x-2.0x), chapter navigation, position persistence and sync
**Addresses:** Speed control, Chapter navigation, Continue from current position
**Avoids:** Pitfall #3 (UI thread blocking) — chunk text during implementation

### Phase 4: Polish & Differentiators

**Rationale:** Features that improve UX but aren't blockers for MVP
**Delivers:** Sleep timer, auto-advance chapters, voice selection UI improvements
**Addresses:** Sleep timer, Auto-advance chapters, Voice selection improvements
**Avoids:** Pitfall #10 (poor text preprocessing), Pitfall #11 (memory leaks)

### Phase Ordering Rationale

- **Model Manager first** — Offline TTS depends on models being available; enables early testing in isolation
- **Background playback before UI integration** — Audio session must work before connecting to reader
- **Reader integration before polish** — Core functionality must work before adding nice-to-haves
- **Avoids pitfalls** — Each phase addresses specific pitfalls identified in research

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1:** Complex native module integration; may need research on specific Sherpa-ONNX API quirks
- **Phase 2:** iOS audio session edge cases; coordinate with existing AVSpeechSynthesizer behavior

Phases with standard patterns (skip research-phase):

- **Phase 3:** Well-documented patterns for reader-to-TTS integration
- **Phase 4:** Standard UX patterns from competitor apps

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                              |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| Stack        | HIGH       | Official documentation for react-native-sherpa-onnx, sherpa-onnx, and Expo CNG; verified npm packages              |
| Features     | MEDIUM     | Based on competitor analysis (Evie, @Voice Aloud, Speech Central) and W3C EPUB TTS spec; limited user testing data |
| Architecture | HIGH       | Detailed component design with Strategy and Adapter patterns; iOS-specific considerations documented               |
| Pitfalls     | HIGH       | Multiple documented issues from GitHub issues and community experience; clear mitigation strategies                |

**Overall confidence:** HIGH

### Gaps to Address

- **Sherpa-ONNX TTS API specifics:** The main react-native-sherpa-onnx library shows TTS as "Not yet supported" — verify TTS functionality with react-native-sherpa-onnx-offline-tts alternative during Phase 1 implementation
- **iOS audio session coordination:** Limited documentation on coexisting with AVSpeechSynthesizer; may need experimentation
- **Memory profiling:** No actual device testing data; plan for Phase 3 testing on lower-end devices

## Sources

### Primary (HIGH confidence)

- react-native-sherpa-onnx (GitHub) — Main library documentation and TTS API
- sherpa-onnx (k2-fsa GitHub) — Underlying ONNX engine, model compatibility
- Expo CNG documentation — Native module integration workflow

### Secondary (MEDIUM confidence)

- Competitor apps (Evie, @Voice Aloud, Speech Central) — Feature analysis
- W3C EPUB 3 TTS Enhancements — TTS standard recommendations

### Tertiary (LOW confidence)

- Community GitHub issues — Individual edge case reports; may not apply universally

---

_Research completed: 2026-02-27_
_Ready for roadmap: yes_
