# Phase 1: Core TTS Engine - Research

**Researched:** 2026-02-27
**Domain:** React Native offline Text-to-Speech with Sherpa-ONNX
**Confidence:** HIGH

## Summary

This phase establishes the foundation for offline TTS in LNReader using the `react-native-sherpa-onnx-offline-tts` library (v0.2.6). The implementation requires building a TTS Engine abstraction layer using the Strategy Pattern, allowing users to toggle between native iOS TTS (`expo-speech`) and offline Piper TTS. Voice models are downloaded on-demand from self-hosted sources (GitHub releases) and stored locally. The Model Manager handles downloading, extracting, and managing Piper voice models from HuggingFace.

**Primary recommendation:** Use `react-native-sherpa-onnx-offline-tts` v0.2.6 with Strategy Pattern abstraction, implementing engine toggle between native `expo-speech` and offline Piper TTS. Default voice should be `en_US-ryan-medium` (balanced quality/size).

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Model Delivery**: Voice models downloaded on first use (not bundled), single default voice available after initial download, hosted on GitHub releases (self-hosted), stored locally on device, user can delete models, app prompts to re-download when voice updates
- **Voice Selection UI**: Simple display with voice name and language only, preview voices before downloading, all voices shown in list, download on tap
- **Error Handling**: Download failure shows error with retry, corrupt model auto-detected and re-downloaded, TTS initialization failure falls back to native iOS TTS
- **Engine Abstraction**: Toggle switch in settings, unified playback controls for both engines, use `react-native-sherpa-onnx-offline-tts` library

### OpenCode's Discretion

- Exact download progress UI design
- Specific voice model to bundle as default (research suggests `en_US-ryan-medium`)
- Exact storage location and file naming conventions
- Error message copy and UI styling

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID     | Description                                               | Research Support                                                                                                                                                            |
| ------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TTS-01 | User can play/pause/stop offline TTS playback             | `generateAndPlay()` API supports text, speakerId, speed parameters. Strategy Pattern enables unified controls across engines.                                               |
| TTS-07 | User can select offline voice from available Piper models | Model Manager handles voice enumeration from local storage. Piper voice models from rhasspy/piper-voices with naming convention `vits-piper-{locale}-{name}-{quality}.onnx` |
| TTS-08 | Toggle between native iOS TTS and offline Piper TTS       | Strategy Pattern allows runtime engine switching. Fallback to `expo-speech` on initialization failure.                                                                      |

</phase_requirements>

---

## Standard Stack

### Core

| Library                              | Version | Purpose                                 | Why Standard                                                                     |
| ------------------------------------ | ------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| react-native-sherpa-onnx-offline-tts | 0.2.6   | Offline TTS with Piper/VITS ONNX models | Only React Native wrapper for offline Sherpa-ONNX TTS with published npm release |
| expo-speech                          | latest  | Native iOS TTS fallback                 | Already integrated in LNReader codebase                                          |
| react-native-fs                      | ^2.20.0 | File system access for model storage    | Standard RN file handling                                                        |
| react-native-zip-archive             | ^6.0.0  | Extract Piper voice model ZIPs          | Required for extracting downloaded models                                        |

### Supporting

| Library                                   | Version | Purpose                           | When to Use                                             |
| ----------------------------------------- | ------- | --------------------------------- | ------------------------------------------------------- |
| @react-native-async-storage/async-storage | ^2.0.0  | Store voice metadata, preferences | For persisting voice list and user selections           |
| react-native-file-downloader / custom     | -       | Download voice models             | Download manager for model files (can implement custom) |

### Alternatives Considered

| Instead of                           | Could Use                                      | Tradeoff                                                                                   |
| ------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| react-native-sherpa-onnx-offline-tts | XDcobra/react-native-sherpa-onnx (TurboModule) | TurboModule version (XDcobra) has TTS as "not yet supported" - stick with kislay99 wrapper |
| react-native-zip-archive             | react-native-compress                          | ZIP extraction needed for Piper models; compress is for compression not extraction         |

**Installation:**

```bash
npm install react-native-sherpa-onnx-offline-tts@0.2.6 react-native-fs@^2.20.0 react-native-zip-archive@^6.0.0
cd ios && pod install
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── tts/
│   ├── engines/
│   │   ├── TTSEngine.ts          # Abstract interface (Strategy)
│   │   ├── NativeTTSEngine.ts   # expo-speech implementation
│   │   └── OfflineTTSEngine.ts  # Sherpa-ONNX implementation
│   ├── models/
│   │   ├── VoiceModel.ts         # Voice model entity
│   │   └── VoiceMetadata.ts     # Voice info (name, language, quality)
│   ├── manager/
│   │   ├── ModelManager.ts      # Download/extract/delete models
│   │   └── VoiceManager.ts      # Voice enumeration and selection
│   ├── PlayerController.ts       # Play/pause/stop controls
│   └── index.ts                 # Public API
├── screens/
│   └── settings/
│       └── VoiceSelectionScreen.tsx
└── utils/
    └── storage.ts               # MMKV wrappers for TTS settings
```

### Pattern 1: Strategy Pattern for TTS Engine Abstraction

**What:** Define a common interface `TTSEngine` with methods `play()`, `pause()`, `stop()`, `setVoice()`, `setSpeed()`. Both `NativeTTSEngine` (expo-speech) and `OfflineTTSEngine` (Sherpa-ONNX) implement this interface.

**When to use:** When you need to switch between different TTS implementations at runtime.

**Example:**

```typescript
// Abstract interface
interface TTSEngine {
  initialize(): Promise<void>;
  speak(text: string): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  setVoice(voiceId: string): void;
  setSpeed(speed: number): void;
  isInitialized(): boolean;
}

// Usage in PlayerController
class PlayerController {
  private engine: TTSEngine;

  setEngine(engine: TTSEngine) {
    this.engine = engine;
  }

  async play(text: string) {
    if (!this.engine.isInitialized()) {
      await this.engine.initialize();
    }
    await this.engine.speak(text);
  }
}
```

### Pattern 2: Model Manager for Download-on-Demand

**What:** Manages voice model lifecycle: check availability, download from URL, extract ZIP, verify integrity, delete when user requests.

**When to use:** For large model files that shouldn't be bundled.

**Example:**

```typescript
class ModelManager {
  private modelDir: string;

  async downloadModel(
    modelId: string,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    const url = this.getModelUrl(modelId);
    const destPath = `${this.modelDir}/${modelId}.zip`;

    // Download with progress
    await this.downloadFile(url, destPath, onProgress);

    // Extract
    await unzip(destPath, this.modelDir);

    // Verify integrity
    const config = this.createConfig(modelId);
    await TTSManager.initialize(JSON.stringify(config));
  }

  async deleteModel(modelId: string): Promise<void> {
    // Clean up files
  }
}
```

### Anti-Patterns to Avoid

- **Bundling models in app binary:** Piper models are 50-200MB. Download on first use as specified in requirements.
- **Blocking UI during model download:** Use background downloads with progress callbacks.
- **Not handling initialization failure:** Always have fallback to native TTS.

---

## Don't Hand-Roll

| Problem                        | Don't Build          | Use Instead                            | Why                                 |
| ------------------------------ | -------------------- | -------------------------------------- | ----------------------------------- |
| ONNX inference                 | Custom native module | `react-native-sherpa-onnx-offline-tts` | Complex native code, already solved |
| Voice model extraction         | Custom unzip utility | `react-native-zip-archive`             | Cross-platform, handles large files |
| File system access             | Native file handling | `react-native-fs`                      | Battle-tested, well-maintained      |
| Audio playback during download | Implement streaming  | Built-in to Sherpa-ONNX library        | Already handles chunked playback    |

**Key insight:** Building custom TTS infrastructure would require implementing Sherpa-ONNX bindings, which is non-trivial native code. The wrapper library handles all native interop.

---

## Common Pitfalls

### Pitfall 1: iOS Audio Session Conflicts

**What goes wrong:** Both native AVSpeechSynthesizer (expo-speech) and Sherpa-ONNX use AVAudioSession. Without proper configuration, they conflict causing playback failures.

**Why it happens:** iOS requires explicit audio session category configuration. Sherpa-ONNX uses AVAudioEngine for playback while expo-speech uses AVSpeechSynthesizer.

**How to avoid:** Configure audio session before playback:

```swift
// For Sherpa-ONNX - handled in native module
AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
AVAudioSession.sharedInstance().setActive(true)
```

**Warning signs:** "Audio session is already active" errors, playback stops unexpectedly.

### Pitfall 2: Model File Path Configuration

**What goes wrong:** Sherpa-ONNX requires absolute paths to model files. Relative paths cause initialization failures.

**Why it happens:** Native ONNX runtime needs file system access. Paths must be absolute and accessible in iOS sandbox.

**How to avoid:** Always use absolute paths from `react-native-fs`:

```typescript
const modelPath = `${RNFS.DocumentDirectoryPath}/voices/${modelId}`;
const config = {
  modelPath: `${modelPath}/model.onnx`,
  tokensPath: `${modelPath}/tokens.txt`,
  dataDir: `${modelPath}/espeak-ng-data/`,
};
```

### Pitfall 3: Large Text Chunking

**What goes wrong:** Passing very long text to `generateAndPlay()` causes memory issues or timeout.

**Why it happens:** ONNX model processes text in chunks. Very long passages can exceed memory or processing limits.

**How to avoid:** Split text into paragraphs/sentences:

```typescript
const CHUNK_SIZE = 500; // characters
function* chunkText(text: string): Generator<string> {
  const sentences = text.split(/(?<=[.!?])\s+/);
  let chunk = '';
  for (const sentence of sentences) {
    if ((chunk + sentence).length > CHUNK_SIZE) {
      yield chunk;
      chunk = sentence;
    } else {
      chunk += ' ' + sentence;
    }
  }
  if (chunk) yield chunk;
}
```

### Pitfall 4: Model Integrity Not Verified

**What goes wrong:** Corrupted downloads cause cryptic runtime errors.

**Why it happens:** Network interruptions, storage issues, or incomplete downloads.

**How to avoid:** Verify model after download:

```typescript
async function verifyModel(modelPath: string): Promise<boolean> {
  const requiredFiles = ['model.onnx', 'tokens.txt'];
  for (const file of requiredFiles) {
    const exists = await RNFS.exists(`${modelPath}/${file}`);
    if (!exists) return false;
  }
  return true;
}
```

---

## Code Examples

### Initialize Sherpa-ONNX Offline TTS

```typescript
// Source: https://github.com/kislay99/react-native-sherpa-onnx-offline-tts
import TTSManager from 'react-native-sherpa-onnx-offline-tts';
import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';

const MODEL_URL =
  'https://github.com/user/voices/releases/download/v1/en_US-ryan-medium.zip';

async function setupOfflineTTS() {
  // 1. Download model
  const modelDir = `${RNFS.DocumentDirectoryPath}/voices/en_US-ryan-medium`;
  await RNFS.mkdir(modelDir);

  const zipPath = `${modelDir}.zip`;
  const downloadResult = await RNFS.downloadFile({
    fromUrl: MODEL_URL,
    toFile: zipPath,
  });

  // 2. Extract
  await unzip(zipPath, `${RNFS.DocumentDirectoryPath}/voices`);

  // 3. Create config with absolute paths
  const base = `${RNFS.DocumentDirectoryPath}/voices/en_US-ryan-medium`;
  const cfg = {
    modelPath: `${base}/en_US-ryan-medium.onnx`,
    tokensPath: `${base}/tokens.txt`,
    dataDir: `${base}/espeak-ng-data/`,
  };

  // 4. Initialize
  await TTSManager.initialize(JSON.stringify(cfg));
}

async function speak(text: string) {
  // speakerId: 0 for single-speaker models (like ryan-medium)
  // speed: 1.0 = normal, 0.5 = half speed, 2.0 = double
  await TTSManager.generateAndPlay(text, 0, 1.0);
}
```

### Strategy Pattern Implementation

```typescript
// src/tts/engines/TTSEngine.ts
export interface TTSEngine {
  readonly name: string;
  initialize(): Promise<void>;
  speak(text: string): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  setVoice(voiceId: string): void;
  setSpeed(speed: number): void;
  isInitialized(): boolean;
  isSpeaking(): boolean;
}

// src/tts/PlayerController.ts
export class PlayerController {
  private currentEngine: TTSEngine | null = null;
  private voiceId: string = '';
  private speed: number = 1.0;

  setEngine(engine: TTSEngine): void {
    this.currentEngine = engine;
  }

  async play(text: string): Promise<void> {
    if (!this.currentEngine) {
      throw new Error('No TTS engine set');
    }
    if (!this.currentEngine.isInitialized()) {
      await this.currentEngine.initialize();
    }
    this.currentEngine.setVoice(this.voiceId);
    this.currentEngine.setSpeed(this.speed);
    await this.currentEngine.speak(text);
  }

  pause(): void {
    this.currentEngine?.pause();
  }

  stop(): void {
    this.currentEngine?.stop();
  }
}
```

---

## State of the Art

| Old Approach         | Current Approach          | When Changed | Impact                               |
| -------------------- | ------------------------- | ------------ | ------------------------------------ |
| Cloud TTS APIs       | Offline Sherpa-ONNX       | 2024+        | Privacy, no network required, faster |
| Single voice bundled | Download-on-demand voices | This phase   | Smaller app size, user choice        |
| Hardcoded voice      | Engine abstraction        | This phase   | Toggle between native/offline        |

**Deprecated/outdated:**

- **expo-speech-only**: Still used as fallback, but offline Piper is primary for this phase
- **Bundled voice models**: Replaced with download-on-demand to reduce app size

---

## Open Questions

1. **Where to host voice models?**

   - What we know: User specified "GitHub releases (self-hosted)"
   - What's unclear: Need to create repository or use existing
   - Recommendation: Create `lnreader-voice-models` repo on GitHub, upload ryan-medium.zip

2. **How to handle voice model updates?**

   - What we know: Need to prompt user when model updates
   - What's unclear: Version checking mechanism
   - Recommendation: Store model version in AsyncStorage, compare with remote manifest

3. **Which quality tier for default voice?**
   - What we know: Piper offers low, medium, high quality tiers
   - What's unclear: Exact file sizes
   - Recommendation: Use `medium` tier (~100MB) - balances quality/storage

---

## Sources

### Primary (HIGH confidence)

- **kislay99/react-native-sherpa-onnx-offline-tts** (GitHub + npm) - Library API and usage patterns
- **rhasspy/piper-voices** (HuggingFace) - Voice models and naming conventions
- **k2-fsa/sherpa-onnx** (GitHub) - Core Sherpa-ONNX documentation

### Secondary (MEDIUM confidence)

- **Piper Documentation** (tderflinger.github.io/piper-docs) - Voice download and configuration

### Tertiary (LOW confidence)

- **Community discussions** - Various implementation patterns from Home Assistant integration

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Verified library exists on npm (v0.2.6), well-documented API
- Architecture: HIGH - Strategy Pattern is standard for engine abstraction
- Pitfalls: MEDIUM - Based on general iOS/Sherpa-ONNX knowledge, not specific to this library

**Research date:** 2026-02-27
**Valid until:** 30 days (library is stable, but verify npm versions)
