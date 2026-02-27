# Requirements: LNReader - Piper TTS

**Defined:** 2026-02-27
**Core Value:** Users can read light novels from multiple sources with offline support and text-to-speech.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core Playback

- [x] **TTS-01**: User can play/pause/stop offline TTS playback
- [ ] **TTS-02**: TTS runs in background with screen off
- [ ] **TTS-03**: User can adjust playback speed (0.5x - 2.0x)
- [ ] **TTS-04**: TTS continues from last position when reopened

### Platform Integration

- [ ] **TTS-05**: Lock screen shows playback controls (play/pause/stop)
- [ ] **TTS-06**: User can navigate to next/previous chapter from TTS
- [x] **TTS-07**: User can select offline voice from available Piper models

### Integration

- [x] **TTS-08**: Toggle between native iOS TTS and offline Piper TTS
- [ ] **TTS-09**: TTS position syncs with reader position

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Features

- **TTS-10**: Sleep timer (auto-stop after duration)
- [ ] **TTS-11**: Text highlighting synced with spoken text
- [ ] **TTS-12**: Pitch control adjustment
- [ ] **TTS-13**: Bluetooth/headset remote controls
- [ ] **TTS-14**: Auto-advance to next chapter when current ends
- [ ] **TTS-15**: Bookmark TTS position for quick return

### Advanced

- **TTS-16**: Pronunciation dictionary for custom terms
- [ ] **TTS-17**: Text preprocessing options (skip special chars, etc.)
- [ ] **TTS-18**: Multi-language model support (30+ languages)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                     | Reason                                       |
| --------------------------- | -------------------------------------------- |
| Cloud TTS                   | Defeats offline requirement; adds complexity |
| Audio recording/save as MP3 | Not the use case                             |
| Voice cloning               | Privacy concerns, complexity                 |
| Subscription/premium voices | Piper provides free high-quality voices      |
| Text input (paste text)     | App is for novels, not arbitrary text        |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement                         | Phase   | Status   |
| ----------------------------------- | ------- | -------- |
| TTS-01: Play/pause/stop offline TTS | Phase 1 | Complete |
| TTS-02: Background playback         | Phase 2 | Pending  |
| TTS-03: Speed control (0.5x-2.0x)   | Phase 3 | Pending  |
| TTS-04: Continue from last position | Phase 3 | Pending  |
| TTS-05: Lock screen controls        | Phase 2 | Pending  |
| TTS-06: Chapter navigation from TTS | Phase 3 | Pending  |
| TTS-07: Voice selection             | Phase 1 | Complete |
| TTS-08: Toggle native/Piper         | Phase 1 | Pending  |
| TTS-09: Position sync with reader   | Phase 3 | Pending  |

**Coverage:**

- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---

_Requirements defined: 2026-02-27_
_Last updated: 2026-02-27 after research synthesis_
