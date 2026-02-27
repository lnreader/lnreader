# Phase 1: Core TTS Engine - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish foundation for offline TTS with engine abstraction and voice management. This includes:

- TTS Engine abstraction layer (Strategy Pattern)
- Model Manager for downloading/extracting Piper voice models
- Basic playback controls (play/pause/stop)
- Voice selection UI with download-on-demand
- Engine toggle between native iOS TTS and offline Piper TTS

</domain>

<decisions>
## Implementation Decisions

### Model Delivery

- Voice models downloaded on first use (not bundled)
- Single default voice available after initial download
- Model hosted on GitHub releases (self-hosted)
- Models stored locally on device after download
- User can delete downloaded models to free storage
- App prompts user to re-download when voice model updates

### Voice Selection UI

- Simple display: voice name and language only
- Preview voices before downloading (tap to hear sample)
- All voices shown in list, download happens on tap

### Error Handling

- Download failure: show error message with retry option
- Corrupt model file: auto-detect and re-download
- TTS initialization failure: fallback to native iOS TTS

### Engine Abstraction

- Toggle switch in settings to choose between native and offline TTS
- Unified playback controls (play/pause/stop/speed) for both engines
- Use `react-native-sherpa-onnx-offline-tts` library for offline TTS

### OpenCode's Discretion

- Exact download progress UI design
- Specific voice model to bundle as default (research which works best)
- Exact storage location and file naming conventions
- Error message copy and UI styling

</decisions>

<specifics>
## Specific Ideas

- Use `react-native-sherpa-onnx-offline-tts` library: https://github.com/kislay99/react-native-sherpa-onnx-offline-tts
- Voices stored locally on phone (self-hosted/offline)
- Fallback to native TTS if offline TTS fails

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 01-core-tts-engine_
_Context gathered: 2026-02-27_
