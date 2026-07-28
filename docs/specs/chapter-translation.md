# In-App Chapter Translation — Product Spec

**Project:** LNReader
**Status:** Draft for review
**Author:** Raj
**Date:** July 27, 2026
**Codebase grounding last verified:** July 27, 2026 (against `master` @ `ac1b2f5`)

> **Note on this document.** The spec below is the product proposal. Claims about
> LNReader's current implementation have been checked against the repository, and
> where the original draft described the *reference app* rather than LNReader, the
> text has been corrected and marked. Verified file paths are collected in
> [Appendix B](#appendix-b-codebase-anchors) so implementers don't have to
> re-derive them. Statements that could **not** be verified are labelled
> `[UNVERIFIED]` rather than asserted.

---

## 1. Problem Statement

Translation is one of the oldest and most consistently requested features in
LNReader's history — the earliest open issue (#439) dates back to v1.1.13. Across
five representative issues (#439, #1553, #1678, #1833, #1837), the ask is
consistent: readers who want to read novels in a language they don't read
natively are currently forced to leave the app (copy-paste into Google Translate,
use Google Lens, etc.), which breaks reading flow and is especially painful for
long-running serials with thousands of chapters.

This has never shipped because we assumed any usable translation backend would
require LNReader to pay for API usage at a scale we can't sustain as an
open-source project with no revenue. That assumption no longer holds: we can ship
translation as **bring-your-own-backend (BYOB)** — the user supplies their own API
key or points at their own local/self-hosted engine, and LNReader becomes the
orchestration layer, not the payer.

There is also an existing community PR (#1851) attempting exactly this. It's gone
through several rounds of maintainer review from CD-Z and the review thread is a
useful source of hard-won architecture constraints — several are folded into this
spec as requirements rather than suggestions, so we don't repeat the same
back-and-forth. See [§4](#4-prior-art--inputs) for its current state.

## 2. Goals

- Let a reader translate a chapter (or a whole novel, or their whole library) into
  a target language, inline in the reader, without leaving the app.
- Support enough providers that most users find at least one free/no-signup option
  and power users can plug in the paid or local engine of their choice.
- Keep LNReader's operating cost at zero. No LNReader-held API keys, no proxying
  user requests through infrastructure we run.
- Make translation a first-class, low-friction toggle in the reader — on par with
  how font/theme settings work today.

## 3. Non-Goals (v1)

- We are not building or shipping a bundled offline translation model. Local/offline
  translation is supported only via the user's own local server (Ollama,
  LibreTranslate self-host, etc.), not a model embedded in the APK.
- We are not doing translation quality evaluation, glossary/terminology management,
  or translation memory (TM) tooling. That's a possible v2+ direction if there's
  demand.
- We are not translating images, only text content.
- iOS is out of scope — LNReader is Android-only. (Confirmed: the repo has no
  `ios/` directory and the README states "light novel reader for Android",
  "Android 7.0 or higher". A vestigial `ios` key exists in `app.json` and a
  `dev:ios` script in `package.json`; neither reflects a supported target.)

## 4. Prior Art / Inputs

**Reference app (screenshots provided):** a mobile reader with a dedicated
"Translation" settings screen exposing ~10 providers (OpenAI, NVIDIA NIM,
DeepSeek, DeepL, SYSTRAN, Google Translate paid + free "scraper" variant, Gemini,
LibreTranslate, Ollama, HuggingFace, Custom HTTP), each with their own
credential/endpoint fields, plus a shared "Translation Queue" section (chunk size,
delay between requests, request timeout, max parallel translations for offline
engines) and per-provider "Test" actions. The reader itself exposes a translate
icon directly in the bottom toolbar next to TTS/comments/etc., which toggles
translated vs. original text for the currently open chapter.

> **Correction.** The description above is of the *reference app's* toolbar, not
> LNReader's. LNReader's reader footer does not currently contain TTS, comments,
> or a rotation lock — see [§6.1](#61-reader-level-toggle) for what's actually
> there and what that implies for placement.

**Community PR #1851** (open against lnreader/lnreader) attempted a first pass at
this and surfaced concrete architecture feedback from a maintainer, which this
spec treats as binding constraints:

- Translation must work for **local/imported novels too**, not just remote sources
  — don't gate the feature on `!novel.isLocal`.
- Translated chapter **content must be stored on the filesystem**, the same way
  downloaded chapter content is — not as a database column. This keeps backups
  sane and avoids bloating the SQLite DB.
- Per-novel translation preferences (auto-translate on/off, target language) are
  **settings, not novel-table columns** — they belong in the persisted settings
  store (comparable to how filter/sort-order-per-novel already works), not in the
  `Novel` schema.
- The provider layer must be **abstracted behind a common interface** from day one
  (`translateBatch()`-style contract), not hard-coded to a single vendor, because
  the ask is explicitly multi-provider.
- Translation config should be a **single discriminated-union config object** per
  provider (`{ provider: 'deepl', plan: 'free' | 'pro' }`), not a flat bag of
  `deeplApiKey`, `microsoftApiKey`, `microsoftRegion`, etc. all coexisting in
  settings state.
- **API keys must not live in plain/unencrypted settings storage.** They need a
  dedicated encrypted store, with an encryption key generated at runtime (e.g. via
  `expo-crypto`/keychain), never hardcoded.
- Only request the API key relevant to the **currently selected provider** — don't
  ask the user to fill in every provider's key up front.
- All user-facing strings go through the existing i18n (`getString`) system from
  the start, not hardcoded English.

### 4.1 Current state of PR #1851

Verified July 27, 2026:

| Field | Value |
|---|---|
| State | Open, unmerged, not a draft |
| Author | `MrPanda009` |
| Title | "feat: Add chapter translation support using Google cloud translate API" |
| Size | 43 files changed, +2385 / −64, across 41 commits |
| Base / head | `lnreader:master` ← `MrPanda009:master` (contributor's own default branch) |
| Mergeability | `dirty` — **currently has merge conflicts against `master`** |
| Reviewer | CD-Z (requested) |
| Created / last updated | 2026-05-21 / 2026-07-26 |

Two things worth flagging, because they bear directly on whether #1851 can be
salvaged versus superseded:

1. **Its own PR description confirms it violates two of the §4 constraints.** It
   states it "Added `translatedText` column to chapter schema" plus "New migration
   for translation storage" (against the filesystem-storage constraint), and
   "Updated `useSettings` to include translation preferences" (against the
   per-novel-settings constraint). These aren't review nitpicks left to interpret
   — they're structural, and reversing them touches most of the 43 files.
2. **It is single-provider** (Google Cloud Translate), against the multi-provider
   abstraction constraint.

Combined with the merge conflicts and the head branch being the contributor's
`master`, the realistic path is that #1851 is **superseded** rather than rebased
into shape. That should be communicated to the author early and courteously —
they've put 41 commits into this, and the constraints that invalidate the approach
came out of review, not from anything stated up front.

## 5. User Stories

1. As a reader who reads primarily in English but wants to follow a Korean web
   novel with no English translation group, I want to translate chapters on the fly
   using an engine I already have API access to.
2. As a reader following a novel with an active human translation group, I want the
   option to translate *raw* (untranslated) chapters as a stopgap while I wait for
   the group's official release, then seamlessly go back to reading the group's
   version once it's out.
3. As a privacy- or cost-conscious reader, I want a free option that requires no
   signup and no API key, even if quality is lower.
4. As a technical reader running a local LLM, I want to point LNReader at my own
   Ollama or LibreTranslate instance and pay nothing per request.
5. As a reader catching up on a backlog, I want to auto-translate an entire novel's
   unread chapters in bulk rather than tapping translate on each one individually.
6. As any user, I want translation to be an obvious, discoverable toggle in the
   reader — not something buried three settings menus deep.

## 6. Feature Overview

### 6.1 Reader-level toggle

A translate control is exposed in the reader for the currently open chapter.
Tapping it translates the chapter into the configured target language and swaps
the displayed text; tapping again reverts to original. State (translated vs.
original) is per-chapter and persists across navigation within the session.

**Placement is an open design question, because the footer is already full.**
LNReader's reader footer (`src/screens/reader/components/ReaderFooter.tsx`)
currently holds exactly five `IconButton`s:

| Icon | Purpose |
|---|---|
| `chevron-left` | Previous chapter |
| `arrow-collapse-up` | Scroll to start |
| `format-list-bulleted` | Open chapter drawer |
| `cog-outline` | Open reader settings sheet |
| `chevron-right` | Next chapter |

There is no TTS, comments, or rotation-lock button in the footer — TTS lives in
the reader bottom sheet (`ReaderBottomSheet/TTSTab.tsx`, driven by
`hooks/useTtsSession.ts`). So "add a sixth icon next to TTS" is not actionable as
written. Options, in rough order of preference:

- **(a)** Add a sixth footer icon, accepting tighter spacing on small screens. Best
  for discoverability (Goal §2, Story #6), worst for layout.
- **(b)** Add a fourth route to the reader bottom sheet's `TabView`, which today
  carries Reader / General / TTS. Consistent with where TTS already lives, but one
  tap deeper — arguably in tension with Story #6.
- **(c)** Footer icon that is conditionally rendered only when translation is
  configured. Keeps the default layout untouched for the majority who never enable
  translation, at the cost of a feature that's invisible until discovered in
  settings.

Recommendation: **(c)**, with the settings screen as the discovery surface. This
needs a decision before Phase 1 UI work starts.

### 6.2 Per-novel auto-translate

From the novel screen, a user can enable "auto-translate" for that novel with a
target language. Once enabled, newly downloaded/opened chapters are translated
automatically in the background (or on-demand on open, configurable) without the
user tapping translate each time.

### 6.3 Bulk translation

From the novel screen or the translation settings screen, a user can trigger
"translate all chapters" for a single novel, or (from settings) across their whole
library. This runs as a queued background job with progress notification,
respecting the rate-limiting settings in [§6.5](#65-rate-limiting--batching-controls).

### 6.4 Provider selection & configuration

A dedicated **Translation** settings screen (not buried in reader-accessibility
settings) lists supported providers grouped by category, each with only the fields
it needs:

| Category | Providers (v1 candidates) | Auth |
|---|---|---|
| Free, no key | Google Translate (unofficial "GTX" endpoint), LibreTranslate (public instance) | none |
| Free-tier API key | Gemini, HuggingFace, DeepL (free plan) | API key |
| Paid API key | OpenAI, Google Cloud Translate, DeepL (pro), Microsoft/Azure Translator, DeepSeek, SYSTRAN | API key |
| Self-hosted / local | Ollama, LibreTranslate (self-hosted), NVIDIA NIM | server URL (+ optional key) |
| Escape hatch | Custom HTTP | URL, method, headers, request/response templates |

Only the active provider's fields are shown/required at a time — not every
provider's key up front (per §4 constraint).

This adds a ninth entry to the top-level settings list in
`src/screens/settings/SettingsScreen.tsx` (which today routes to General,
Appearance, Library, Reader, Repositories, Tracking, Backup, and Advanced), plus a
new screen registration in the settings stack navigator.

LLM-based providers (OpenAI, Gemini, DeepSeek, Ollama, NIM, HuggingFace)
additionally expose an editable **system prompt** and **user prompt template** with
`{SOURCE_LANG}`, `{TARGET_LANG}`, `{TEXT}` placeholders, since translation
quality/style for prose (versus literal MT engines) benefits from prompt control —
e.g. preserving honorifics, tone, dialogue formatting.

The Custom HTTP provider is the generalized fallback: user supplies API URL,
method, headers (`{apiKey}` substitution supported), a request body template
(`{texts}`, `{text}`, `{text_esc}`, `{source}`, `{target}`, `{source_name}`,
`{target_name}` placeholders), and a response JSON path (e.g. `translatedText`) to
extract the result. This covers any provider we don't explicitly integrate.

Each provider row has a "Test" action that sends a trivial sample string and
reports success/failure inline, so users can validate config before trusting it on
real chapters.

### 6.5 Rate limiting & batching controls

Because translation requests hit third-party APIs with rate limits (and
self-hosted/local engines have their own throughput limits), the settings screen
exposes:

- **Translation chunk size** (paragraphs per request; recommended range 20–100) —
  chapters are split into chunks rather than sent as one giant request, both for
  API payload limits and to bound the blast radius of a failed request.
- **Delay between requests** (ms) — throttle between chunk requests to a single
  provider.
- **Request timeout** (seconds) — abandon a chunk request past this and surface an
  error instead of hanging.
- **Max parallel translations** — for local/offline engines only, since local
  hardware can often handle concurrent requests where a rate-limited cloud API
  can't.
- A **Translation Queue** status view showing idle/active/queued chunk jobs, useful
  once bulk translation is running.

Note that LNReader already has a background task queue with per-plugin concurrency
limits (`src/services/backgroundTasks/`), used by the download path. The
translation queue should be built on that rather than as a parallel scheduler —
see [Appendix B](#appendix-b-codebase-anchors).

### 6.6 Clear/reset

A "Clear all translations" action in settings removes cached translated content
(frees storage, useful after changing providers or target language).

## 7. Non-Functional Requirements

- **Zero cost to LNReader.** No default provider ships with a maintainer-supplied
  key. Free-tier options in the list (GTX endpoint, public LibreTranslate) are free
  to the *user*, not subsidized by us.
- **Storage:** translated chapter text is written to the filesystem in the same
  location/pattern as downloaded chapter content, not the SQLite DB (per PR #1851
  review feedback). Concretely, downloads today write to
  `${NOVEL_STORAGE}/${pluginId}/${novelId}/${chapterId}/index.html` via
  `NativeFile.writeFile`, where `NOVEL_STORAGE` is
  `NativeFile.ExternalDirectoryPath + '/Novels'`. Translated content should sit
  alongside as a sibling file in the same chapter folder (e.g.
  `index.<targetLang>.html`), which keeps one chapter's assets — including the
  already-downloaded images the original HTML references via `file://` — in a
  single directory, and makes "clear all translations" a glob-and-delete.
- **Security:** provider API keys are stored in an encrypted store with a
  runtime-generated encryption key held in Android keychain/secure storage — never
  a hardcoded encryption key, never plaintext in the regular settings store.
  **Resolved during Phase 1 implementation.** `react-native-mmkv` v4.3.2 does
  still accept `encryptionKey` (plus `encryptionType: 'AES-256'`) on
  `createMMKV()`, so MMKV-native encryption is used rather than hand-rolling
  AES-GCM over `@noble/ciphers` — fewer moving parts, and the ciphertext never
  passes through JS. Two caveats found while wiring it up:
  - MMKV caps the key at **32 bytes** for AES-256, so base64-encoding 32 random
    bytes (44 characters) overflows it. `secureStorage.ts` instead maps random
    bytes onto a 64-character alphabet to get exactly 32 characters.
  - The tree has **no WebCrypto polyfill**, so `randomBytes` from
    `@noble/ciphers/utils.js` would fail at runtime in React Native. `expo-crypto`
    (`getRandomBytesAsync`) supplies the entropy and `expo-secure-store` holds the
    key in the Android Keystore; both were added as dependencies at the SDK 57
    pinned versions.
- **Resilience:** a failed chunk (timeout, rate-limit, malformed response) should
  not corrupt the whole chapter — partial failure should be visible and retryable
  rather than silently dropped or silently left in the source language mid-chapter.
- **i18n:** all new UI strings go through the existing `getString` pipeline. The
  string source is `src/i18n/languages/en/strings.json` (not `en.json`), consumed
  via `getString` from `@i18n/translations`; there is a `pnpm generate:string-types`
  script that regenerates the string key types, which must be run after adding
  keys. Non-English locales live in sibling directories under
  `src/i18n/languages/` and are managed via Crowdin (`crowdin.yml`) — don't
  hand-edit them.
- **No telemetry on translation content.** We don't log or transmit chapter text
  anywhere except directly to the user's configured provider.

## 8. Explicitly Open Questions

These need a decision before/during implementation, flagged here rather than
silently resolved:

1. **Legality/ToS of the free "GTX" Google Translate scraping endpoint.** It's
   unofficial, undocumented, and can break or get IP-blocked without notice. Do we
   ship it as a listed provider (as the reference app and PR #1851 both do), and if
   so, how do we message its unreliability to users?
2. **Cross-chunk context loss.** Splitting a chapter into 20–100-paragraph chunks
   means an LLM-based provider translates each chunk without seeing the rest of the
   chapter — pronoun/name consistency and tone can drift chunk-to-chunk. Do we
   accept this for v1, or is there a cheap mitigation (e.g. carrying a short rolling
   summary/last-N-paragraphs as context into the next chunk's prompt)?
3. **Where exactly bulk "translate all" jobs run** — foreground only while app is
   open, or via a background task that survives app close? The reference app's
   "Translation Queue: idle" indicator implies persistence across some period; scope
   needs to be nailed down. LNReader's existing `BackgroundTaskQueue` and its
   checkpointing behaviour in the download path are the precedent to follow here.
4. **Raw vs. translated as separate reading state.** Story #2 above (reading raws
   as a stopgap before an official translation exists) implies we may want the
   reader to distinguish "translate the original/raw text" from "this novel already
   has translated chapters but I want a different language" — these are subtly
   different modes and the UI should not conflate them.
5. **Auto-translate trigger point** — on chapter download, on chapter open, or
   both? Affects whether users on metered connections get surprised by background
   API calls.
6. **Translate control placement in the reader** (added during codebase review) —
   see [§6.1](#61-reader-level-toggle). The footer already holds five buttons and
   contains no TTS/comments controls to sit "next to", so the original placement
   assumption doesn't hold and needs an explicit decision.

## 9. Phased Rollout

**Phase 1 — MVP** *(landed — see Appendix C)*

- Provider abstraction interface + 3 providers: one free/no-key (GTX or public
  LibreTranslate), one BYOK cloud (Gemini or DeepL), one local (Ollama).
- Manual per-chapter translate toggle in the reader only. No auto-translate, no
  bulk translation yet.
- Chunking + basic rate-limit delay (fixed, not user-configurable yet).
- Encrypted key storage from day one (not deferred — this was a correctness issue
  in PR #1851's early iterations, not a nice-to-have).
- Filesystem-based storage for translated content from day one.

**Phase 2 — Provider breadth + per-novel auto-translate** *(landed — see Appendix C)*

- Round out the provider list (OpenAI, DeepSeek, Microsoft, SYSTRAN, HuggingFace,
  NVIDIA NIM, Custom HTTP escape hatch).
- Per-novel auto-translate toggle + target language, stored in the settings store
  (not the novel DB table).
- User-configurable chunk size, delay, timeout in settings.
- "Test" action per provider.

**Phase 3 — Bulk & polish**

- Bulk "translate all chapters" per novel and library-wide, with a queue/progress
  UI.
- Max-parallel-translations control for local engines.
- Prompt template customization for LLM-based providers.
- "Clear all translations" action.

## 10. Success Metrics

Since LNReader doesn't run product analytics/telemetry today (and this spec
explicitly avoids adding content telemetry), success here is qualitative rather
than dashboard-driven:

- The five linked GitHub issues (and any duplicates) can be closed as shipped.
- Community PR #1851 either gets superseded by this spec's implementation or its
  remaining unresolved review threads get folded in and it ships. (Per
  [§4.1](#41-current-state-of-pr-1851), superseded is the likelier outcome.)
- No increase in GitHub issues about the app phoning home or leaking API keys.
- Anecdotal community feedback (Discord/GitHub reactions) on the released feature.

## Appendix A: Source Issues

- [#439](https://github.com/lnreader/lnreader/issues/439) — "Embed a translator in
  the reader" (earliest ask, v1.1.13; community suggested DeepL and Bergamot)
- [#1553](https://github.com/lnreader/lnreader/issues/1553) — "Translating novels
  with Google translate"
- [#1678](https://github.com/lnreader/lnreader/issues/1678) — "Add Support for
  Online & Offline Translation Engine" (most detailed ask; explicitly requests
  modular provider architecture, caching, engine priority/fallback). Verified open,
  labelled `Feature Request`, filed against v2.0.2. Note it also asks for **engine
  priority/fallback** — chaining to a second provider when the first fails — which
  this spec does not currently cover in any phase. Worth an explicit accept/reject.
- [#1833](https://github.com/lnreader/lnreader/issues/1833) — "New feature: In-app
  translation tool"
- [#1837](https://github.com/lnreader/lnreader/issues/1837) — "Translation
  features" (linked to PR #1851)
- [PR #1851](https://github.com/lnreader/lnreader/pull/1851) — open, unmerged
  implementation attempt; review thread from CD-Z is the primary source for the
  architecture constraints in §4 and §7. Current state detailed in §4.1.

## Appendix B: Codebase Anchors

Verified July 27, 2026 against `master` @ `ac1b2f5`. These are the existing
patterns each §4/§7 constraint maps onto, so implementation follows precedent
rather than inventing structure.

| Concern | Existing precedent | Location |
|---|---|---|
| Filesystem chapter storage | `NOVEL_STORAGE` = `ExternalDirectoryPath + '/Novels'`; chapter folder is `{pluginId}/{novelId}/{chapterId}/`, content written as `index.html` | `src/utils/Storages.ts`, `src/services/download/downloadChapter.ts` |
| Per-novel settings (not DB columns) | `useNovelSettings` + `NOVEL_SETTINGS_PREFIX` / `defaultNovelSettings`, persisted via the novel store helper | `src/hooks/persisted/useNovelSettings.ts`, `src/hooks/persisted/useNovel/` |
| Global persisted settings | MMKV-backed zustand stores | `src/hooks/persisted/useSettings.ts`, `src/utils/mmkv/mmkv.ts`, `src/utils/mmkv/zustand-adapter.ts` |
| AES-GCM encryption (already present) | `import { gcm } from '@noble/ciphers/aes.js'` | `src/plugins/pluginManager.ts`, `package.json` (`@noble/ciphers`) |
| Background queue w/ concurrency limits | `BackgroundTaskQueue`, plus download checkpointing for resumability | `src/services/backgroundTasks/`, `src/services/download/downloadCheckpoint.ts` |
| Rate-limit / cooldown precedent | `getChapterDownloadCooldownMs`, surfaced via a settings modal | `src/hooks/persisted/useSettings.ts`, `src/screens/settings/SettingsGeneralScreen/modals/DownloadCooldownModal.tsx` |
| Reader footer controls | five `IconButton`s (see §6.1) | `src/screens/reader/components/ReaderFooter.tsx` |
| Reader bottom sheet tabs (where TTS lives) | three-route `TabView` — Reader / General / TTS | `src/screens/reader/components/ReaderBottomSheet/ReaderBottomSheet.tsx` |
| Top-level settings list | eight entries routed via `SettingsStack` | `src/screens/settings/SettingsScreen.tsx`, `src/navigators/` |
| i18n | `getString` from `@i18n/translations`; English source at `languages/en/strings.json`; `pnpm generate:string-types` regenerates key types | `src/i18n/`, `package.json` |
| Provider-abstraction analogue | the plugin system is the closest existing "pluggable third-party backend behind a common interface" pattern in the codebase and is worth reading before designing the translation provider interface | `src/plugins/pluginManager.ts`, `src/plugins/types/` |

## Appendix C: Implementation Status

**Phase 1 service layer — landed.** `src/services/translation/`:

| Module | Responsibility |
|---|---|
| `types.ts` | Provider interface, discriminated-union config, `TranslationError` with a retryable/non-retryable classification |
| `secureStorage.ts` | Encrypted MMKV store; key generated via `expo-crypto`, held in `expo-secure-store` |
| `storage.ts` | Filesystem read/write/delete of `index.<lang>.html`, plus the §6.6 sweep |
| `htmlSegments.ts` | Extracts text nodes for translation and writes them back, leaving markup and `file://` image sources untouched |
| `chunking.ts` | Chunk sizing and splitting, with offsets that map failures back to segment positions |
| `providers/` | `libretranslate`, `gemini`, `ollama`, plus shared HTTP error classification and LLM prompt/JSON handling |
| `translateChapter.ts` | Orchestration: chunk pacing, per-request timeouts, partial-failure survival, retry-only-failed-chunks |

**Phase 1 reader integration — landed.** Open question 6 was resolved as
**option (c)**: the translate control is a sixth footer icon rendered only once
a usable provider is configured. "Configured" is stricter than "enabled" — a
provider needing an API key it does not have keeps the control hidden rather
than showing a button that fails on tap. State lives in
`screens/reader/hooks/useChapterTranslation.ts`, composed in `ChapterContext`
so the `useChapter` loading pipeline is untouched.

**Phase 2 — landed.**

| Area | What shipped |
|---|---|
| Provider breadth | Ten providers. OpenAI, DeepSeek, NVIDIA NIM and HuggingFace share one `openaiCompatible.ts` implementation (same `/chat/completions` contract, different defaults) but stay distinct ids so each gets its own key in the encrypted store. Microsoft and SYSTRAN are literal MT engines with their own response shapes. `customHttp.ts` is the templated escape hatch. |
| Per-novel auto-translate | `useNovelTranslationSettings`, reachable from the novel overflow menu — offered for local novels too. |
| Configurable pacing | Chunk size, inter-request delay and request timeout are editable in settings. |
| Test action | `testProvider.ts` sends one sample string through the *same* `translateBatch` path a real translation uses, so a passing test cannot mask a broken translation path. |

Two Phase 2 decisions worth recording:

- **Per-novel settings use their own MMKV key** (`NOVEL_TRANSLATION_SETTINGS_<id>`)
  rather than extending `NovelSettings`. That store is a validated zustand
  domain store bound to the novel screen's lifecycle, and translation needs to
  be readable from background paths that never mount it. The §4 constraint —
  settings, not a `Novel` column — is still satisfied.
- **Open question 5 (auto-translate trigger) is answered "on open" only.**
  Translating at download time would mean background API calls on a metered
  connection without the reader present, which is the surprise the question was
  raised about. Revisit if bulk translation (Phase 3) makes it moot.

Covered by 128 tests across the translation service and reader hook (555
repo-wide). Remaining for Phase 3: bulk "translate all", the queue/progress UI,
max-parallel for local engines, prompt-template editing, and a "clear all
translations" action (the service function exists and is tested; only the UI is
missing).

A note for whoever picks this up: `clearMocks`/`restoreMocks` are set at the top
level of `jest.config.js`, but the repo uses `projects`, and Jest ignores those
keys outside a project config — so mock state currently leaks between tests
repo-wide. `__tests__/storage.test.ts` clears mocks itself rather than depending
on it. Worth fixing globally, but that is not this feature's change to make.
