# Architecture Patterns: Offline TTS Integration in LNReader

**Domain:** React Native (Expo) Mobile App — Offline Text-to-Speech
**Researched:** 2026-02-27
**Confidence:** HIGH

## Executive Summary

This architecture document outlines how to integrate offline TTS (Piper/Sherpa-ONNX) with LNReader's existing TTS system. The existing architecture uses `expo-speech` (AVSpeechSynthesizer on iOS) with a TurboModule for media notifications. The new architecture introduces a TTS Engine abstraction layer that allows users to choose between native iOS voices and offline Piper voices.

**Key architectural decisions:**

1. **TTS Engine Abstraction** — Both engines accessed through a unified interface
2. **Model Manager** — Handles download, caching, and lifecycle of voice models
3. **Shared Media Control** — Reuses existing NativeTTSMediaControl for notifications
4. **Background Audio** — Requires iOS audio session configuration for offline TTS

---

## Recommended Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          React Native App                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     TTS Service Layer                            │   │
│  │  ┌───────────────────┐    ┌──────────────────────────────────┐  │   │
│  │  │   TTS Controller │    │      TTS Engine Abstraction     │  │   │
│  │  │  (useTTSSettings)│    │  ┌────────────┐ ┌─────────────┐ │  │   │
│  │  └─────────┬─────────┘    │  │ Native TTS │ │ Offline TTS │ │  │   │
│  │            │               │  │  (expo-   │ │ (Sherpa-    │ │  │   │
│  │            │               │  │  speech)  │ │  ONNX)      │ │  │   │
│  │            ▼               │  └────────────┘ └─────────────┘ │  │   │
│  │  ┌───────────────────┐    └──────────────────────────────────┘  │   │
│  │  │  Voice Selector  │                                           │   │
│  │  │   (TTSTab)       │                                           │   │
│  │  └───────────────────┘                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              Model Manager (Offline TTS Only)                    │   │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────────┐            │   │
│  │  │ Download │──►│ Extract  │──►│ Cache (RNFS)  │            │   │
│  │  │ Service  │   │ Service  │   │   Manager     │            │   │
│  │  └──────────┘   └──────────┘   └──────────────┘            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              NativeTTSMediaControl (Shared)                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐          │   │
│  │  │ Notification│  │ Media Ctrl  │  │ Lock Screen  │          │   │
│  │  │   Service   │  │   Service   │  │   Controls   │          │   │
│  │  └─────────────┘  └─────────────┘  └──────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### Component 1: TTS Controller (React)

| Aspect                | Details                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Responsibility**    | Orchestrates TTS playback, manages settings, handles engine selection                                          |
| **Location**          | New: `src/services/tts/TTSController.ts`                                                                       |
| **Communicates With** | TTS Engine Abstraction, Voice Selector, Model Manager                                                          |
| **Public API**        | `speak(text)`, `pause()`, `stop()`, `setEngine(engine)`, `setVoice(voice)`, `setRate(rate)`, `setPitch(pitch)` |
| **State**             | Current engine, playback state, settings                                                                       |

**Example Interface:**

```typescript
interface TTSController {
  // Playback control
  speak(text: string, options?: TTSOptions): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;

  // Engine selection
  setEngine(engine: 'native' | 'offline'): void;
  getEngine(): 'native' | 'offline';

  // Settings
  setVoice(voice: TTSVoice): void;
  setRate(rate: number): void;
  setPitch(pitch: number): void;

  // Events
  onPlaybackStateChange(callback: (state: PlaybackState) => void): void;
  onProgress(callback: (current: number, total: number) => void): void;
}
```

### Component 2: TTS Engine Abstraction

| Aspect                | Details                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Responsibility**    | Unified interface hiding implementation differences between native and offline TTS                         |
| **Location**          | New: `src/services/tts/engines/`                                                                           |
| **Sub-Components**    | `NativeTTSEngine.ts`, `OfflineTTSEngine.ts`                                                                |
| **Communicates With** | TTS Controller, Native Modules                                                                             |
| **Public API**        | `initialize()`, `speak()`, `stop()`, `pause()`, `setVoice()`, `setRate()`, `setPitch()`, `isInitialized()` |

**Pattern: Strategy Pattern**

```typescript
// Base interface
interface TTSEngine {
  initialize(): Promise<void>;
  speak(text: string): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;
  setVoice(voice: TTSVoice): void;
  setRate(rate: number): void;
  setPitch(pitch: number): void;
  getVoices(): Promise<TTSVoice[]>;
  isInitialized(): boolean;
  dispose(): void;
}

// Factory
class TTSEngineFactory {
  static createEngine(type: 'native' | 'offline'): TTSEngine {
    switch (type) {
      case 'native':
        return new NativeTTSEngine();
      case 'offline':
        return new OfflineTTSEngine();
    }
  }
}
```

### Component 3: Native TTS Engine (Adapter)

| Aspect             | Details                                                         |
| ------------------ | --------------------------------------------------------------- |
| **Responsibility** | Wraps existing expo-speech implementation                       |
| **Location**       | New: `src/services/tts/engines/NativeTTSEngine.ts`              |
| **Dependencies**   | `expo-speech`, existing settings                                |
| **Pattern**        | Adapter Pattern — adapts expo-speech API to TTSEngine interface |

**Implementation:**

```typescript
import * as Speech from 'expo-speech';

export class NativeTTSEngine implements TTSEngine {
  private currentVoice: Voice | null = null;
  private currentRate = 1;
  private currentPitch = 1;
  private isSpeaking = false;

  async initialize(): Promise<void> {
    // No initialization needed for expo-speech
  }

  async speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      Speech.speak(text, {
        voice: this.currentVoice?.identifier,
        rate: this.currentRate,
        pitch: this.currentPitch,
        onDone: () => {
          this.isSpeaking = false;
          resolve();
        },
        onError: error => {
          this.isSpeaking = false;
          reject(error);
        },
      });
      this.isSpeaking = true;
    });
  }

  stop(): void {
    Speech.stop();
    this.isSpeaking = false;
  }

  // ... implements remaining interface
}
```

### Component 4: Offline TTS Engine (Adapter)

| Aspect             | Details                                                              |
| ------------------ | -------------------------------------------------------------------- |
| **Responsibility** | Wraps Sherpa-ONNX for offline TTS playback                           |
| **Location**       | New: `src/services/tts/engines/OfflineTTSEngine.ts`                  |
| **Dependencies**   | `react-native-sherpa-onnx-offline-tts` or `react-native-sherpa-onnx` |
| **Pattern**        | Adapter Pattern — adapts Sherpa-ONNX API to TTSEngine interface      |

**Key Considerations:**

- Sherpa-ONNX generates audio synchronously or streams it
- Requires audio session configuration for background playback
- Must handle model lifecycle (load/unload)
- Callback-based completion detection differs from expo-speech

```typescript
import TTSManager from 'react-native-sherpa-onnx-offline-tts';

export class OfflineTTSEngine implements TTSEngine {
  private modelId: string | null = null;
  private currentSpeakerId = 0;
  private currentSpeed = 1.0;

  async initialize(): Promise<void> {
    // Check if model is downloaded, load it
    if (!this.modelId) {
      throw new Error('TTS model not initialized. Call setModel() first.');
    }
    await TTSManager.initialize(this.modelId);
  }

  async speak(text: string): Promise<void> {
    await TTSManager.generateAndPlay(
      text,
      this.currentSpeakerId,
      this.currentSpeed,
    );
  }

  stop(): void {
    // Sherpa-ONNX may not have stop; consider using audio session
    TTSManager.stop?.();
  }

  // ... implements remaining interface
}
```

### Component 5: Model Manager

| Aspect             | Details                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Responsibility** | Handles voice model download, extraction, caching, and lifecycle                                                                |
| **Location**       | New: `src/services/tts/ModelManager.ts`                                                                                         |
| **Dependencies**   | `react-native-fs`, `react-native-zip-archive`                                                                                   |
| **Public API**     | `downloadModel(modelId)`, `getModelPath(modelId)`, `deleteModel(modelId)`, `getInstalledModels()`, `isModelDownloaded(modelId)` |

**Model Storage Structure:**

```
Documents/
└── tts-models/
    ├── vits-piper-en_US-ryan-medium/
    │   ├── en_US-ryan-medium.onnx
    │   ├── tokens.txt
    │   └── espeak-ng-data/
    └── vits-piper-de_DE-thorsten-low/
        └── ...
```

### Component 6: Voice Selector (UI Extension)

| Aspect                | Details                                                              |
| --------------------- | -------------------------------------------------------------------- |
| **Responsibility**    | UI for selecting TTS engine and voice                                |
| **Location**          | Modify: `src/screens/reader/components/ReaderBottomSheet/TTSTab.tsx` |
| **New Features**      | Engine toggle (Native/Offline), Offline voice list                   |
| **Communicates With** | TTS Controller, Model Manager                                        |

---

## Data Flow

### Flow 1: TTS Playback (Both Engines)

```
User taps "Play"
       │
       ▼
WebViewReader.speakText(text)
       │
       ▼
TTSController.speak(text)
       │
       ├─────────────────────────────┐
       │                             │
       ▼                             ▼
NativeTTSEngine.speak()      OfflineTTSEngine.speak()
       │                             │
       │                             ▼
       │                     ModelManager.loadModel()
       │                             │
       ▼                             ▼
expo-speech.speak()          TTSManager.generateAndPlay()
       │                             │
       │◄──── Completion ──────────► │
       │                             │
       ▼                             ▼
onDone callback ──────────► WebViewReader
       │
       ▼
webViewRef.injectJavaScript('tts.next()')
```

### Flow 2: Model Download (Offline TTS First Use)

```
User enables Offline TTS
       │
       ▼
TTSTab selects "Offline" engine
       │
       ▼
TTSController.setEngine('offline')
       │
       ▼
OfflineTTSEngine.initialize()
       │
       ▼
ModelManager.isModelDownloaded(modelId)?
       │
       ├─ No ──► Show download prompt
       │              │
       │              ▼
       │        ModelManager.downloadModel()
       │              │
       │              ▼
       │        RNFS.downloadFile()
       │              │
       │              ▼
       │        unzip archive
       │              │
       │              ▼
       │        Save to Documents/tts-models/
       │
       └─ Yes ──► Continue to playback
```

### Flow 3: Notification Updates

```
Playback state changes
       │
       ▼
TTSController emits state
       │
       ▼
ttsNotification.ts functions (existing)
       │
       ├─ showTTSNotification()
       ├─ updateTTSPlaybackState()
       └─ updateTTSProgress()
              │
              ▼
       NativeTTSMediaControl (existing TurboModule)
              │
              ▼
       iOS MediaPlayer / Lock Screen Controls
```

---

## Suggested Build Order

Based on component dependencies:

| Order | Component                     | Rationale                                                                    |
| ----- | ----------------------------- | ---------------------------------------------------------------------------- |
| 1     | **Model Manager**             | Offline TTS depends on models being available; build first to enable testing |
| 2     | **Offline TTS Engine**        | New component; needs Model Manager; test in isolation                        |
| 3     | **Native TTS Engine Adapter** | Wraps existing expo-speech; minimal new code                                 |
| 4     | **TTS Controller**            | Orchestrates both engines; depends on engine adapters                        |
| 5     | **Voice Selector UI**         | UI changes depend on TTS Controller being ready                              |
| 6     | **Background Audio**          | Configure iOS audio session for offline TTS                                  |
| 7     | **Integration Testing**       | Test full flow with WebViewReader                                            |

### Dependency Graph

```
ModelManager
    │
    ▼
OfflineTTSEngine ──────┐
    │                   │
    │                   ▼
    │            TTSController ◄── NativeTTSEngine
    │                   │
    │                   ▼
    └─────────────► VoiceSelector (UI)
                          │
                          ▼
                    WebViewReader (Integration)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Engine Logic in UI Components

**What:** Putting TTS engine selection and playback logic directly in WebViewReader or TTSTab

**Why bad:**

- Duplicated code across components
- Hard to test and maintain
- Makes switching engines difficult

**Instead:** Use TTS Controller as single source of truth

```typescript
// BAD: Logic in UI
const handleSpeak = () => {
  if (engine === 'native') {
    Speech.speak(text, options);
  } else {
    TTSManager.generateAndPlay(text, speakerId, speed);
  }
};

// GOOD: Delegated to controller
const handleSpeak = () => {
  ttsController.speak(text);
};
```

### Anti-Pattern 2: Direct Model Access in Engine

**What:** OfflineTTSEngine directly handling file paths and downloads

**Why bad:**

- Violates Single Responsibility Principle
- Makes it difficult to switch models or add caching
- Hard to test without network

**Instead:** Use Model Manager for all model-related operations

### Anti-Pattern 3: Ignoring Audio Session Configuration

**What:** Not configuring iOS audio session for offline TTS

**Why bad:**

- Audio stops when app backgrounds
- No lock screen controls
- Conflicts with other audio apps

**Instead:** Configure AVAudioSession category `.playback` for offline TTS

---

## iOS-Specific Considerations

### Audio Session Configuration

Offline TTS requires iOS audio session configuration. Add to `ios/LNReader/AppDelegate.mm` or create native module:

```objc
// In AppDelegate
AVAudioSession *session = [AVAudioSession sharedInstance];
[session setCategory:AVAudioSessionCategoryPlayback
         withOptions:AVAudioSessionCategoryOptionMixWithOthers
               error:nil];
[session setActive:YES error:nil];
```

Or create a TurboModule:

```typescript
// spec/AudioSession.ts
export interface Spec extends TurboModule {
  setCategory(category: string, options: number): Promise<boolean>;
  setActive(active: boolean): Promise<boolean>;
}
```

### Background Modes

Enable in `ios/LNReader/Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

---

## Scalability Considerations

| Concern           | At MVP                   | At Scale                               |
| ----------------- | ------------------------ | -------------------------------------- |
| **Model Storage** | Single model (~50MB)     | Multiple languages (cull unused)       |
| **Memory**        | Load model on speak      | Keep model loaded during session       |
| **Download**      | Show progress modal      | Background download with notifications |
| **Voice List**    | Hardcoded popular voices | API-fetched from model metadata        |
| **Cache**         | Documents/ directory     | Consider MMKV for metadata             |

---

## Sources

### Official Documentation

- **Sherpa-ONNX TTS:** https://k2-fsa.github.io/sherpa/onnx/tts/index.html
- **react-native-sherpa-onnx-offline-tts:** https://github.com/kislay99/react-native-sherpa-onnx-offline-tts
- **expo-speech:** https://docs.expo.dev/versions/latest/sdk/speech/

### iOS Audio

- **Apple Audio Session:** https://developer.apple.com/documentation/avfoundation/configuring-your-app-for-media-playback
- **Background Audio:** https://developer.apple.com/library/archive/qa/qa1668/_index.html

### Architecture Patterns

- **Strategy Pattern:** https://refactoring.guru/design-patterns/strategy
- **Adapter Pattern:** https://refactoring.guru/design-patterns/adapter

---

## Research Notes

**Note on library selection:** The primary library `react-native-sherpa-onnx` (by XDcobra) shows TTS as "Not yet supported" in its README. The alternative `react-native-sherpa-onnx-offline-tts` (by kislay99) specifically targets TTS. Consider:

- If TTS is needed immediately: Use `react-native-sherpa-onnx-offline-tts`
- If waiting for TTS support in main library is acceptable: Use `react-native-sherpa-onnx`

The architecture above supports swapping either library via the OfflineTTSEngine adapter.

---

_Architecture research for: Offline TTS (Piper/Sherpa-ONNX) in React Native Expo_
_Researched: 2026-02-27_
