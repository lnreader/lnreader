# Feature Landscape

**Domain:** Offline Text-to-Speech (TTS) for Novel Reader Apps
**Researched:** 2026-02-27

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature                        | Why Expected                                                    | Complexity | Notes                                                                   |
| ------------------------------ | --------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| Play/Pause/Stop controls       | Basic playback control is essential for any audio feature       | Low        | Must have immediate access via UI and notifications                     |
| Background playback            | Users want to listen while doing other tasks or with screen off | Medium     | Requires native audio session configuration; critical for novel reading |
| Speed control (0.5x - 2.0x)    | Different reading speeds for comprehension vs. scanning         | Low        | Standard expectation; most TTS apps offer 0.5x to 3x                    |
| Continue from current position | TTS should pick up where user left off, not restart             | Low        | Must persist position in storage; sync with reader position             |
| Lock screen controls           | Users control playback without unlocking phone                  | Medium     | Requires native media session integration                               |
| Voice selection                | Users want to choose preferred voice (if multiple available)    | Low        | Start with one voice; expand later                                      |
| Chapter navigation             | Navigate between chapters via TTS controls                      | Medium     | Important for novels with many chapters                                 |
| Text highlighting              | Visual synchronization with spoken text improves comprehension  | Medium     | W3C EPUB TTS spec recommends this; enhances UX significantly            |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature                      | Value Proposition                                              | Complexity | Notes                                                             |
| ---------------------------- | -------------------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| Sleep timer                  | Users fall asleep to stories; auto-stop prevents battery drain | Low        | Popular in apps like Evie, Audify; set durations: 15/30/45/60 min |
| Pitch control                | Adjust voice tone for preference or accessibility              | Low        | Piper voices have limited pitch range; native TTS has more        |
| Auto-advance chapters        | Seamlessly continue to next chapter when current ends          | Low        | Natural flow for long reading sessions                            |
| Pronunciation dictionary     | Fix mispronunciations for names/terms specific to novels       | Medium     | Advanced feature; stores custom phoneme mappings                  |
| Text preprocessing options   | Skip special characters, numbers as words, etc.                | Low        | Improves naturalness of narration                                 |
| Bookmark TTS position        | Save specific listening points for quick return                | Low        | Complements existing bookmarks                                    |
| Bluetooth/headset controls   | Control playback from wired or wireless earphones              | Medium     | Standard in apps like Evie; uses remote command APIs              |
| Multi-language model support | Support voices for different languages                         | Medium     | Piper supports 30+ languages; enables reading foreign novels      |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature                   | Why Avoid                                                           | What to Do Instead                      |
| ------------------------------ | ------------------------------------------------------------------- | --------------------------------------- |
| Cloud TTS integration          | Defeats offline requirement; adds complexity and cost               | Stick to local Piper/Sherpa-ONNX voices |
| Audio recording/save as MP3    | Not the use case; TTS is for reading assistance                     | If needed, user can use screen recorder |
| Voice cloning                  | Privacy concerns, complexity, not expected in reader app            | Use available Piper voices              |
| Subscription/premium voices    | Piper provides free high-quality voices; contradicts offline nature | Focus on making free voices excellent   |
| Social sharing of TTS sessions | Not relevant for personal reading                                   | N/A                                     |
| Built-in translation           | Complicates app; user can use separate translator                   | Keep focused on reading                 |
| Text input (paste text)        | App is for novels, not arbitrary text                               | Reader provides chapter content         |

## Feature Dependencies

```
Voice Selection → Voice Model Download (must download before use)
Speed Control → TTS Engine Configuration (set on init)
Background Playback → Native Audio Session Setup
Lock Screen Controls → Native Media Session Registration
Continue from Position → Position Storage + Reader Sync
Chapter Navigation → Chapter List Access from Reader
Text Highlighting → Text Position Tracking + UI Sync
Sleep Timer → Timer Logic + Auto-stop
Bluetooth Controls → Native Remote Command Handling
```

## MVP Recommendation

Prioritize:

1. **Play/Pause/Stop** — Core functionality
2. **Background playback** — Essential for reading while doing other tasks
3. **Continue from current position** — Critical for novels; must sync with reader
4. **Speed control** — Basic expectation
5. **Lock screen controls** — Native UX integration

Defer:

- **Sleep timer** — Nice to have, not critical for MVP
- **Pronunciation dictionary** — Advanced; address if users complain about specific mispronunciations
- **Text highlighting** — Adds complexity; valuable but can be added in phase 2
- **Bluetooth controls** — Most users will use phone; can add later

## Sources

- **Competitor Analysis:**

  - @Voice Aloud Reader (Android) — Market leader with 10M+ downloads
  - Evie (Android/iOS) — Open source, feature-complete TTS reader
  - Speech Central (iOS/Android) — "Ultimate Voices" positioning
  - Voice Dream Reader — Premium TTS reader with 200+ voices
  - FBReader Premium — Classic ebook reader with TTS

- **Documentation & Standards:**

  - W3C EPUB 3 TTS Enhancements (2025) — https://www.w3.org/TR/epub-tts-10/
  - sherpa-onnx TTS API — https://github.com/k2-fsa/sherpa-onnx

- **Feature Research:**
  - Play store/app store listings for top TTS reader apps
  - User reviews mentioning requested/praised features
  - Reddit discussions (r/ereader, r/books) about TTS preferences

---

_Research for: Offline TTS (Piper/Sherpa-ONNX) in React Native Expo_
_Confidence Level: MEDIUM — Based on competitor analysis and websearch; limited user testing data_
