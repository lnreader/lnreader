# Stack Research

**Domain:** Offline Text-to-Speech (TTS) for React Native / Expo
**Researched:** 2026-02-27
**Confidence:** HIGH

## Recommended Stack

### Core TTS Library

| Technology               | Version | Purpose                     | Why Recommended                                                                                                        |
| ------------------------ | ------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| react-native-sherpa-onnx | 0.2.0   | Offline TTS via Sherpa-ONNX | Production-ready TurboModule supporting VITS/Piper models, works on iOS/Android, automatic Core ML acceleration on iOS |
| sherpa-onnx (underlying) | ~1.12.x | ONNX runtime for TTS        | Actively maintained by k2-fsa, supports 30+ languages via Piper models                                                 |

**Why react-native-sherpa-onnx:**

- Uses React Native's New Architecture (TurboModules) for efficient JS-native communication
- Automatic detection and use of hardware acceleration (Core ML on iOS, NNAPI on Android)
- Single package handles both STT and TTS (future-proofing)
- iOS XCFramework auto-downloaded during `pod install` — no manual native setup required
- Supports multiple TTS model formats: VITS, Piper, Kokoro, Matcha, KittenTTS

### Supporting Libraries

| Library                  | Version | Purpose                  | When to Use                                                |
| ------------------------ | ------- | ------------------------ | ---------------------------------------------------------- |
| react-native-fs          | ^2.14.x | File system access       | Required for downloading/storing TTS model files           |
| react-native-zip-archive | ^2.0.x  | ZIP extraction           | Required for extracting downloaded .tar.bz2 model archives |
| expo-file-system         | ^18.0.x | Expo-compatible file ops | Alternative to react-native-fs if staying within Expo SDK  |

**When to use each:**

- `react-native-fs` + `react-native-zip-archive`: Direct control over download/extraction lifecycle
- `expo-file-system`: If you want to stay within Expo's ecosystem and avoid additional native dependencies

### Model Management

| Approach                      | Description               | Use Case                              |
| ----------------------------- | ------------------------- | ------------------------------------- |
| Bundled assets                | Ship models in app bundle | Small models, guaranteed availability |
| Runtime download              | Download on first launch  | Larger models, reduce app size        |
| Play Asset Delivery (Android) | Google's dynamic delivery | Android-only, optimized delivery      |

**Recommended for LNReader:** Runtime download with caching — voice models are 20-50MB each, too large to bundle.

## Installation

```bash
# Core TTS library (TurboModule)
npm install react-native-sherpa-onnx@0.2.0

# Supporting libraries for model download/extraction
npm install react-native-fs@^2.14.0 react-native-zip-archive@^2.0.0

# iOS: Run pod install after adding native modules
cd ios && pod install && cd ..
```

### Expo Configuration

Since `react-native-sherpa-onnx` contains native code, you must use Expo's **CNG (Continuous Native Generation)** workflow:

```bash
# Generate native directories
npx expo prebuild

# Then build
npx expo run:ios
```

Or with EAS Build:

```bash
eas build -p ios
```

## Alternatives Considered

| Recommended                      | Alternative                          | When to Use Alternative                            |
| -------------------------------- | ------------------------------------ | -------------------------------------------------- |
| react-native-sherpa-onnx (0.2.0) | react-native-sherpa-onnx-offline-tts | Only need TTS, want simpler API, lighter footprint |
| react-native-sherpa-onnx         | Build custom TurboModule             | Need very specific sherpa-onnx build options       |
| Runtime download                 | Bundled models                       | Very small model, offline-first priority           |

**Why react-native-sherpa-onnx over the lighter alternative:**

- Actively maintained (554 commits vs 18)
- Production-ready iOS support (vs experimental)
- Hardware acceleration (Core ML auto-detection)
- Future STT capability if needed

## What NOT to Use

| Avoid                                | Why                                                  | Use Instead                                       |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------------------------- |
| react-native-sherpa-onnx-offline-tts | Less maintained, experimental iOS support            | react-native-sherpa-onnx                          |
| Legacy Bridge Native Modules         | Deprecated in RN 0.76+, no New Architecture benefits | TurboModules (what react-native-sherpa-onnx uses) |
| Building sherpa-onnx from scratch    | Complex C++ build, large time investment             | Pre-built XCFramework via pod install             |
| Web-based TTS (Cloud APIs)           | Defeats offline requirement                          | react-native-sherpa-onnx                          |

## Model Selection for Novel Reading

### Recommended Piper/VITS Models

| Model                              | Size  | Quality    | Languages    | Best For              |
| ---------------------------------- | ----- | ---------- | ------------ | --------------------- |
| vits-piper-en_US-ryan-medium       | ~50MB | Medium     | English      | Balanced quality/size |
| vits-piper-en_US-libritts_r-medium | ~50MB | High       | English      | Best English voice    |
| vits-piper-de_DE-thorsten-low      | ~30MB | Low-Medium | German       | Smaller size          |
| kokoro-us                          | ~40MB | High       | English (US) | Multi-voice support   |

**Recommendation for LNReader:** Start with `vits-piper-en_US-ryan-medium` — good quality, reasonable size, well-tested with sherpa-onnx.

### Model Download Sources

- Official: https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models
- Mirror: https://huggingface.co/rhasspy/piper-voices (original Piper models)

## Version Compatibility

| Package                        | Compatible With            | Notes                               |
| ------------------------------ | -------------------------- | ----------------------------------- |
| react-native-sherpa-onnx@0.2.0 | React Native >= 0.70       | New Architecture recommended        |
| react-native-sherpa-onnx@0.2.0 | iOS 13.0+                  | XCFramework auto-downloaded         |
| react-native-sherpa-onnx@0.2.0 | Android API 24+            | Full support                        |
| react-native-fs@^2.14          | Expo SDK 52+               | Use expo-file-system as alternative |
| react-native-zip-archive@^2.0  | iOS 13.0+, Android API 24+ | Cross-platform                      |

**Expo SDK Compatibility:**

- Requires Expo SDK 52+ (for New Architecture support)
- Must run `npx expo prebuild` before building

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                      React Native App                        │
├─────────────────────────────────────────────────────────────┤
│  TTS Service Layer                                          │
│  ┌─────────────────┐  ┌──────────────────┐                 │
│  │ Existing Native │  │ Sherpa-ONNX TTS  │                 │
│  │ AVSpeechSynth   │  │ (Piper/VITS)     │                 │
│  └────────┬────────┘  └────────┬─────────┘                 │
│           │                    │                            │
│           └────────┬───────────┘                            │
│                    ▼                                         │
│           ┌─────────────────┐                               │
│           │ TTS Controller  │ ← User selects engine         │
│           └────────┬────────┘                               │
│                    │                                         │
│  ┌─────────────────▼─────────────────┐                      │
│  │       NativeTTSMediaControl      │ ← Existing spec      │
│  └───────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘

Model Download Flow:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Check Cache │───►│ Download    │───►│ Extract to  │
│  (RNFS exists)│    │ (RNFS)      │    │ App Sandbox │
└──────────────┘    └──────────────┘    └──────────────┘
```

## Sources

- **Official Documentation:**

  - https://github.com/XDcobra/react-native-sherpa-onnx — Main library, TTS docs
  - https://github.com/k2-fsa/sherpa-onnx — Underlying ONNX engine
  - https://k2-fsa.github.io/sherpa/onnx/tts/piper.html — Model conversion docs

- **NPM Package:**

  - https://www.npmjs.com/package/react-native-sherpa-onnx — v0.2.0 (latest)

- **Expo Integration:**

  - https://docs.expo.dev/modules/config-plugin-and-native-module-tutorial — Native modules in Expo
  - https://docs.expo.dev/workflow/continuous-native-generation/ — CNG workflow

- **Community:**
  - https://github.com/kislay99/react-native-sherpa-onnx-offline-tts — Alternative lighter library

---

_Stack research for: Offline TTS (Piper/Sherpa-ONNX) in React Native Expo_
_Researched: 2026-02-27_
