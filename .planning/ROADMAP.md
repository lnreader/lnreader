# Roadmap: LNReader - Piper TTS

**Generated:** 2026-02-27
**Depth:** Standard
**Total Phases:** 3
**Platforms:** iOS and Android (cross-platform)

## Phases

- [ ] **Phase 1: Core TTS Engine** - TTS Engine abstraction, Model Manager, basic playback
- [ ] **Phase 2: Background Playback** - Audio session config, lock screen controls
- [ ] **Phase 3: Reader Integration** - Speed control, position sync, chapter navigation

## Phase Details

### Phase 1: Core TTS Engine

**Goal:** Establish foundation for offline TTS with engine abstraction and voice management

**Platforms:** iOS and Android

**Depends on:** Nothing (first phase)

**Requirements:** TTS-01, TTS-07, TTS-08

**Success Criteria** (what must be TRUE):

1. User can play, pause, and stop offline TTS playback from the app UI
2. User can select an offline Piper voice from a list of available downloaded models
3. User can toggle between native iOS TTS (expo-speech) and offline Piper TTS engines
4. Voice models can be downloaded, extracted, and stored in app Documents directory

**Plans:** TBD

---

### Phase 2: Background Playback

**Goal:** Enable TTS to play in background with lock screen controls

**Platforms:** iOS and Android (platform-specific audio session config)

**Depends on:** Phase 1

**Requirements:** TTS-02, TTS-05

**Success Criteria** (what must be TRUE):

1. TTS continues playing when app is backgrounded (user switches to another app)
2. TTS continues playing when device screen is locked
3. Lock screen displays playback controls (play/pause/stop) that function correctly

**Plans:** TBD

---

### Phase 3: Reader Integration

**Goal:** Connect TTS to reader for seamless playback with position sync

**Platforms:** iOS and Android

**Depends on:** Phase 2

**Requirements:** TTS-03, TTS-04, TTS-06, TTS-09

**Success Criteria** (what must be TRUE):

1. User can adjust playback speed between 0.5x and 2.0x from TTS controls
2. TTS resumes from the last played position when user reopens TTS
3. User can navigate to next or previous chapter directly from TTS controls
4. TTS playback position syncs with reader scroll position bidirectionally

**Plans:** TBD

---

## Coverage Map

| Phase                        | Requirements                   |
| ---------------------------- | ------------------------------ |
| Phase 1: Core TTS Engine     | TTS-01, TTS-07, TTS-08         |
| Phase 2: Background Playback | TTS-02, TTS-05                 |
| Phase 3: Reader Integration  | TTS-03, TTS-04, TTS-06, TTS-09 |

## Progress

| Phase                  | Plans Complete | Status      | Completed |
| ---------------------- | -------------- | ----------- | --------- |
| 1. Core TTS Engine     | 0/1            | Not started | -         |
| 2. Background Playback | 0/1            | Not started | -         |
| 3. Reader Integration  | 0/1            | Not started | -         |

---

_Last updated: 2026-02-27_
