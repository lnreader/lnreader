# Domain Pitfalls

**Domain:** Offline Text-to-Speech (Piper/Sherpa-ONNX) Integration in React Native/Expo
**Researched:** 2026-02-27
**Confidence:** HIGH

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Audio Session Conflicts with Other Voice Libraries

**What goes wrong:** TTS stops working after other voice-related libraries (like react-native-voice) reset the iOS audio session. The existing native AVSpeechSynthesizer stops functioning, requiring manual reinitialization.

**Why it happens:** iOS audio sessions are exclusive. When one library configures the AVAudioSession (e.g., for voice recording), it can reset the session configuration that TTS depends on. Both cannot share the audio session simultaneously without proper coordination.

**Consequences:**

- TTS playback fails silently or produces no audio
- Users must restart the app or reinitialize TTS
- Poor experience when combining TTS with voice input features

**Prevention:**

- Implement proper audio session category handling in native code
- Use `AVAudioSessionCategoryPlayback` with `.mixWithOthers` option when needed
- Add audio session reinitialization logic when conflicts are detected
- Consider using separate audio sessions or explicit audio session activation/deactivation

**Detection:**

- Log audio session configuration changes
- Monitor for TTS failures after other voice library usage
- Test by switching between voice input and TTS rapidly

**Phase:** Implementation Phase - Native Module Integration

---

### Pitfall 2: ONNX Model Loading Failures on iOS

**What goes wrong:** `InferenceSession.create()` fails to load Sherpa-ONNX TTS models on iOS with "Can't load a model: failed to load model" error, while the same models work on Android.

**Why it happens:**

- iOS has stricter file access security (Sandbox)
- Model files stored incorrectly (e.g., bundled in assets vs downloaded to documents directory)
- Path resolution issues with iOS file system
- Missing content provider permissions

**Consequences:**

- TTS completely non-functional on iOS
- Users see errors or silent failures
- Different behavior between debug and production builds

**Prevention:**

- Download models to app's Documents directory, not bundle assets
- Use `react-native-fs` with correct paths: `${RNFS.DocumentDirectoryPath}/models/`
- Test with actual device (not just simulator) since some features work differently
- Verify file exists before loading: `RNFS.exists(modelPath)`
- Consider using iOS CoreML acceleration which is auto-detected by sherpa-onnx

**Detection:**

- Log model path and loading attempts
- Check file existence before load
- Monitor for iOS-specific failures in crash reporting

**Phase:** Implementation Phase - Model Management

---

### Pitfall 3: Blocking UI Thread During TTS Synthesis

**What goes wrong:** App becomes unresponsive during long text-to-speech synthesis. The UI freezes or stutters, especially with large paragraphs of novel text.

**Why it happens:** ONNX model inference is CPU-intensive. If synthesis runs on the main thread, it blocks React Native's JS thread and UI rendering. Processing large text chunks without chunking overwhelms the engine.

**Consequences:**

- App lag or complete freeze during TTS
- Poor user experience, especially for long-form content (novels)
- Battery drain from sustained high CPU usage
- Potential app termination by OS for excessive resource usage

**Prevention:**

- Sherpa-ONNX uses TurboModules for efficient JS-native communication, but synthesis still runs on native threads
- Chunk long text into smaller segments (e.g., paragraphs or sentences)
- Implement text preprocessing to split by sentence boundaries
- Add loading indicators during synthesis
- Test on lower-end devices to ensure smooth performance

**Detection:**

- Monitor JS thread frame times
- Test with long chapters (>5000 words)
- Observe battery usage during extended TTS playback

**Phase:** Implementation Phase - Performance

---

### Pitfall 4: App Size Explosion from Bundled Voice Models

**What goes wrong:** App bundle size becomes too large (50MB+ per voice model) when voice models are bundled with the app, leading to download issues, App Store rejection concerns, and poor user experience.

**Why it happens:** Piper/VITS voice models are 20-50MB each. Bundling multiple languages or voice options multiplies this. Users must download large updates.

**Consequences:**

- Longer download times and potential abandonment
- App Store size limits (150MB for iOS without additional downloads)
- Poor user experience on limited data plans
- Update size bloat

**Prevention:**

- Use runtime download (lazy loading) instead of bundling
- Implement model cache management with size limits
- Start with single English voice (~50MB) and add more later
- Use Play Asset Delivery on Android for dynamic delivery
- Show download progress and allow cancellation
- Consider deleting unused models to free space

**Phase:** Implementation Phase - Model Management

---

## Moderate Pitfalls

### Pitfall 5: Missing Background Audio Capabilities

**What goes wrong:** TTS audio stops when app goes to background or screen locks. Users cannot listen while reading or using other apps.

**Why it happens:** iOS requires specific background mode capabilities and audio session configuration to continue playback in background. Default configuration stops audio when app is backgrounded.

**Consequences:**

- Incomplete user experience - TTS tied to screen-on time
- Poor accessibility use case (VoiceOver users expect background audio)
- No hands-free novel reading experience

**Prevention:**

- Add `UIBackgroundModes` -> `audio` to iOS Info.plist
- Configure audio session for background playback:
  ```swift
  AVAudioSession.sharedInstance().setCategory(
    .playback,
    mode: .spokenAudio,
    options: [.allowAirPlay, .allowBluetooth]
  )
  ```
- Use TurboModule audio APIs which handle this properly
- Test with app in background and screen locked

**Phase:** Implementation Phase - Background Playback

---

### Pitfall 6: Poor iOS Lock Screen / Control Center Integration

**What goes wrong:** TTS doesn't appear in iOS lock screen or Control Center. Users cannot control playback without opening the app. Media controls disappear when pausing.

**Why it happens:** Missing MPNowPlayingInfoCenter and MPRemoteCommandCenter configuration. Some libraries only show controls during active playback, not paused state.

**Consequences:**

- Users must unlock phone to control TTS
- Poor system integration compared to native audio apps
- Disorienting when controls disappear on pause

**Prevention:**

- Implement `react-native-music-control` or similar for lock screen controls
- Configure MPNowPlayingInfoCenter with:
  - Title (chapter/novel name)
  - Artist (app name)
  - Playback progress
- Set up MPRemoteCommandCenter for play/pause/skip
- Maintain playback state even when paused (don't clear nowPlayingInfo)

**Phase:** Implementation Phase - Media Controls

---

### Pitfall 7: No Handling of Audio Interruptions

**What goes wrong:** TTS continues playing during phone calls, alarm sounds, or other system audio, or doesn't resume after interruptions.

**Why it happens:** Missing audio interruption handling (AVAudioSession.interruptionNotification). System audio "ducking" or mixing not configured properly.

**Consequences:**

- Awkward overlapping audio
- User frustration when TTS doesn't pause for calls
- Poor accessibility experience

**Prevention:**

- Subscribe to audio session interruption notifications
- Handle `.began` interruptions: pause TTS, save position
- Handle `.ended` interruptions: optionally resume based on user preference
- Use `.duckOthers` option for mixing or `.mixWithOthers` as appropriate

**Phase:** Implementation Phase - Audio Session Management

---

### Pitfall 8: Incorrect Expo Prebuild Workflow

**What goes wrong:** Native iOS project doesn't include Sherpa-ONNX native code after running `npx expo prebuild`. Build fails with missing native module errors.

**Why it happens:**

- Missing proper native module installation steps
- Not regenerating native directories after adding new native dependencies
- Conflicts between Expo's generated files and CocoaPods

**Consequences:**

- Build failures
- Lost native customizations
- Development delays

**Prevention:**

- After adding `react-native-sherpa-onnx`, run:
  ```bash
  npx expo prebuild --clean
  cd ios && pod install && cd ..
  ```
- Do not manually edit the generated iOS files (they'll be overwritten)
- Use EAS Build or properly configured local builds
- Test on actual device - some TurboModules work differently on simulator

**Phase:** Setup Phase - Build Configuration

---

## Minor Pitfalls

### Pitfall 9: Incorrect Model File Format or Version

**What goes wrong:** TTS produces no audio or crashes when generating speech. Error logs show model format issues.

**Why it happens:** Using wrong model format (e.g., Python-trained VITS instead of ONNX-converted), incompatible model version, or corrupted downloads.

**Consequences:**

- TTS non-functional
- Confusing error messages
- Wasted debugging time

**Prevention:**

- Use official sherpa-onnx compatible models from: https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models
- Verify model files are .onnx format (not .pt or .pth)
- Check model version compatibility with sherpa-onnx version
- Verify checksums after download

**Phase:** Implementation Phase - Model Setup

---

### Pitfall 10: Poor Text Preprocessing for TTS

**What goes wrong:** TTS mispronounces novel-specific terms (character names, made-up words, technical terms). Long unpunctuated text causes awkward phrasing.

**Why it happens:** Default TTS models use generic pronunciation dictionaries. Novel text often contains:

- Made-up fantasy/sci-fi names
- Japanese/Chinese names romanized
- Unusual punctuation
- Extremely long sentences

**Consequences:**

- Humorous or confusing TTS output
- Poor reading experience
- User frustration with voice quality

**Prevention:**

- Implement text preprocessing:
  - Add punctuation to long text chunks
  - Consider custom pronunciation dictionary if available
  - Split at paragraph boundaries
- Accept that offline TTS won't match cloud TTS pronunciation
- Provide user setting for voice speed adjustment to help with comprehension

**Phase:** Implementation Phase - Text Processing

---

### Pitfall 11: Memory Leaks from Unreleased TTS Resources

**What goes wrong:** App's memory usage grows over time during extended TTS sessions. Eventually app crashes or is killed by OS.

**Why it happens:**

- Not properly disposing TTS engine when switching voices or stopping
- Audio buffers not released
- Model remains loaded in memory after use

**Prevention:**

- Implement proper cleanup in component unmount / effect cleanup:
  ```typescript
  useEffect(() => {
    // Initialize TTS
    return () => {
      // Cleanup: stop playback, release resources
      stopTTS();
      releaseTTSEngine();
    };
  }, []);
  ```
- Monitor memory usage during extended playback
- Test app for memory growth over 30+ minutes of use

**Phase:** Implementation Phase - Resource Management

---

## Phase-Specific Warnings

| Phase Topic          | Likely Pitfall                                                      | Mitigation                                                                 |
| -------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Setup/Build**      | Incorrect Expo prebuild workflow, missing native module integration | Follow proper CNG workflow, run prebuild --clean after adding dependencies |
| **Model Setup**      | Model loading failures, wrong format                                | Use official ONNX models, verify downloads, test on actual device          |
| **Core Integration** | Audio session conflicts with existing TTS                           | Coordinate audio session handling between native and Sherpa TTS            |
| **Performance**      | UI blocking, memory leaks                                           | Chunk text, implement cleanup, test on low-end devices                     |
| **Background/Audio** | Background playback failures, no lock screen controls               | Configure Info.plist background modes, add media controls                  |
| **UX Polish**        | Poor text processing, no interruption handling                      | Preprocess text, handle phone calls and notifications                      |

---

## Summary

The most critical pitfalls for LNReader's offline TTS implementation:

1. **Audio session conflicts** - Must coordinate with existing AVSpeechSynthesizer
2. **iOS model loading** - Use correct file paths and Documents directory
3. **Background/lock screen** - Add proper capabilities and media controls
4. **Performance** - Chunk text, manage memory, don't block UI

Focus implementation phases on:

- Phase 1: Native module integration with proper audio session handling
- Phase 2: Model download and loading system
- Phase 3: Background playback and lock screen controls
- Phase 4: Performance optimization and text preprocessing

---

## Sources

- **Primary Source:** GitHub Issue #275 - TTS fails due to audio session conflicts (ak1394/react-native-tts)
- **ONNX Runtime Issues:** GitHub Issues #26931, #27062 - Model loading failures on iOS
- **TTS Mobile Pitfalls:** Zilliz/Milvus AI Reference Guide - Common pitfalls deploying TTS in mobile
- **Expo Documentation:** Custom native code and CNG workflow
- **Sherpa-ONNX:** Official docs and GitHub releases for model compatibility

---
