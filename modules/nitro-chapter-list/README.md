# nitro-chapter-list

Native Android `RecyclerView` chapter lists for Novel, the reader's chapter
drawer, Downloads and Updates.
Scrolling, flinging and fast-scrubbing through large lists do no JS work per
frame once the rows are available.

Android only.

## Layout

The Kotlin code (`android/src/main/java/com/margelo/nitro/nitrochapterlist`) is
split so another screen can reuse the list without the chapter parts:

| Package   | What                                                   | Files                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`    | Generic native list host, knows nothing about chapters | `ListHostView` (SwipeRefreshLayout > RecyclerView, optional header item, events, commands), `ListHostViewManager` (hosting the React header child), `ListRecyclerView` (exact metrics, jumps), `ListMetrics` (the offset maths, with or without a header), `HighlightVisibility`, `ListFastScroller` (fork of androidx `FastScroller`, Apache 2.0), `HeaderContainer`, `ScrollEventGate`, `RangeRequester`, `ListEvent` |
| `chapter` | The chapter list on top of `core`                      | `ChapterListView`, `ChapterListAdapter`, `ChapterRowView`, `IconView`, `ChapterRowFormatter` (row text), `ChapterListModel` (rows, selection, downloading), `ChapterListPerf`                                                                                                                                                                                                                                           |
| root      | Entry points that Nitro and RN look up by name         | `HybridChapterListStore` (the Nitro store), `ChapterListStoreRegistry`, `ChapterListViewManager` (`LNChapterListView`), `NitroChapterListPackage`                                                                                                                                                                                                                                                                       |

Downloads and Updates share the `grouped` adapter and `LNGroupedChapterListView`.
Their store receives a flat snapshot of section headings, novel groups and
expanded chapter rows. RecyclerView recycles each chapter independently.
Updates observes single-chapter groups and expanded groups through one database
subscription. The grouped list also uses the core fast scroller, with exact
offsets for its shorter headings and loading rows.

The reader's chapter drawer reuses `LNChapterListView` with `variant="drawer"`;
see [Drawer variant](#drawer-variant). The sections below describe the Novel
screen's list.

| Piece                                                      | Role                                                                                                                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChapterListStore` (Nitro HybridObject)                    | Bulk row data, selection and downloading state. JS writes and native reads. Each JS call is copied and applied in one main-thread post, which produces the smallest set of `notifyItemRange*` calls. |
| `LNChapterListView` (Fabric codegen component)             | Its single React child (the novel header) is placed in the RecyclerView's header item, the way `react-native-pager-view` hosts its pages.                                                            |
| Rows                                                       | Built in code with a custom measure and layout, 64dp tall. Icons come from the same `MaterialDesignIcons.ttf` that the RN app loads. Row events carry the chapter's position as well as its id.      |
| JS wrapper (`src/components/NativeChapterList` in the app) | `useChapterListStore()` syncs the novel store into the native store, and `<NativeChapterList>` wraps the view and the ref.                                                                           |

The view gets its store through the `storeId` prop (`ChapterListStoreRegistry`).
The adapter's item count is the full filtered total. Rows that aren't loaded yet
bind a placeholder and fire `onRequestRange` once per batch, and JS answers with
`loadUpToBatch`. Scroll offset and range are computed exactly in
`ChapterRecyclerView`, from the header height plus fixed row heights, because
LinearLayoutManager's averaged estimate is wrong with a tall header.
`ChapterRecyclerView` also turns long jumps (thumb drags, `scrollToOffset`) into
`scrollToPositionWithOffset`, so they never bind the rows in between.

Scroll events are ScrollView-shaped `topScroll` events, emitted through RN's pooled
`ScrollEvent`, so `useAnimatedScrollHandler` handles them on the UI thread.
Reanimated still forwards each event to an empty JS listener, so the events are
gated (`ScrollEventGate`). They go out on every change only up to
`scrollEventMaxOffset` (the app bar fade), and past that only when the offset
crosses one of `scrollEventThresholds` (the scroll-to-top FAB). Scrolling deeper
than that does no JS work at all.

## Drawer variant

`src/screens/reader/components/ChapterDrawer` renders `<NativeChapterList
variant="drawer">` with its own `useChapterListStore` (the reader has its own
`NovelContextProvider`, so it can't share the Novel screen's store). It reuses
the view, adapter, model and formatter; only the props below differ.

- **Headerless.** The drawer renders no React child. `ListHostView.setHasHeader(false)`
  and `ChapterListAdapter.headerCount = 0` drop the header item, so rows start at
  adapter position 0 and `ListMetrics` leaves the header out of every offset.
  `HeaderContainer` may keep a height from before; headerless, it never counts.
  The Novel screen keeps its header item at position 0.
- **Rows** (`ChapterRowView(drawer = true)`): the chapter name on one line and
  the release date when there is one, 12dp horizontal and 10dp vertical padding
  inside a 2dp vertical margin, 14/20 and 12/16 text. No bookmark, unread dot,
  download button, long press or selection. Every row has the same height,
  `ChapterRowView.drawerRowHeight` (62dp at the default font scale; it follows
  the font scale), so scroll metrics stay exact. The date goes through
  `ChapterRowFormatter.releaseLabel`, the same path as the Novel subtitle's
  date, so `dateFormat` and `relativeTimestamps` apply and the parity fixture
  covers it. Unread rows use `onSurface` / `onSurfaceVariant`, read ones
  `outline`.
- **Highlight.** `ChapterListStore.setHighlighted(id?)` marks the current
  chapter: a `secondaryContainer` background with `onSecondaryContainer` text.
  It's a payload bind (`ChapterListModel.Payload.HIGHLIGHT`), so only the old
  and the new row rebind. A chapter that isn't loaded yet is highlighted when
  its batch arrives.
- **`initialPosition`.** The row put at the top before the first layout that
  has rows (applied once, after a whole prop update, since it depends on the
  variant). The drawer passes `max(0, currentIndex - 2)`. Later chapter changes
  scroll with `scrollToIndex`.
- **`onHighlightedVisibilityChange({ state: 'above' | 'visible' | 'below' })`.**
  Computed natively (`HighlightVisibility`) from the first and last visible
  rows against the highlighted row's position, after scrolls, layouts and
  model changes, and sent only when the state changes. Nothing is sent while
  the highlighted row isn't loaded. The drawer's footer buttons use it.
- **No scroll events.** The drawer variant never sends `topScroll`, and
  pull-to-refresh is off. Once mounted, the only JS → native traffic is store
  syncs when the data changes, plus scroll commands from the footer buttons.
- **Batching** is the same as the Novel screen's (`useChapterBatchRequests`):
  the item count is the full filtered total and placeholders call
  `onRequestRange`, answered with `loadUpToBatch`. Reading progress re-creates
  `chapters` continuously while the reader is open; the store diff turns that
  into `updateRows` for the changed rows, never a `reset`.
- **Swipe-to-close.** `react-native-drawer-layout` closes through a
  gesture-handler pan, which sees touches at the root regardless of which view
  handles them. `ListRecyclerView` only claims a gesture (and calls
  `requestDisallowInterceptTouchEvent`) once it starts a vertical drag, or
  on a touch that stops a fling, the same as the ScrollView the drawer used
  before. Its `notifyNativeGestureStarted` cancels JS responder touches, which
  the pan isn't.

## Maintenance

Chapter rows share `ChapterRowView.kt`. The Novel screen binds them in
`ChapterListAdapter.kt` and formats them with `ChapterRowFormatter.kt`.
Downloads and Updates bind their rows in `GroupedChapterListAdapter.kt`.

### Row text

Native formats each row's title and subtitle when the row is bound, so only
the rows on screen are ever formatted, and changing a display setting only
rebinds those. The work is split so that native never parses or translates:

- **JS** (`src/components/NativeChapterList/chapterListSync.ts`):
  - `toChapterRow` sends raw values. The release time is parsed with dayjs,
    exactly as `formatDate` parses it. Text it can't parse is sent as is.
  - `buildChapterRowFormat` builds the `rowFormat` prop: the translated
    templates, the relative-date labels (Today, Yesterday, Tomorrow, and
    "Last …" and next week for each weekday) and the month names, all produced
    by the same dayjs and i18n calls `formatDate` makes.
- **Native** (`ChapterRowFormatter`): picks a label for days -6..6 from today
  (the same rule as `formatDate`, with today taken from the device clock, and
  a rebind at midnight), applies the dayjs date patterns, and joins the parts
  with `" •  "`. `'default'` dates use the locale's short date from Android's
  ICU, which Hermes' `Intl` is built on.

The parity fixture `fixtures/chapter-row-format.json` keeps the two in step.
`chapterRowFormatParity.test.ts` checks it against the JS formatting, and
`ChapterRowFormatterParityTest.kt` checks the Kotlin formatter against it in
several time zones. After changing a case or a string, regenerate it:

```sh
UPDATE_CHAPTER_ROW_FIXTURE=1 pnpm exec jest --selectProjects rn -- chapterRowFormatParity
```

The locale short date (`'default'` format, more than six days away) is the one
part the fixture can't cover. Check it on a device.

After changing `src/specs/*.nitro.ts`, regenerate the bindings:

```sh
cd modules/nitro-chapter-list && npx nitrogen
```

React Native codegen for `src/fabric` runs as part of the Android build.

## Known differences from the former React rows

- The subtitle is one string, so the reading-progress part uses the subtitle
  colour. The former React row drew it in `outline`.
- The gap between subtitle parts is the text `" •  "`. The former React row used a 5dp
  margin before `"•  "`.
- A chapter with no chapter number shows "Chapter " (empty number). JS shows
  i18n-js's missing-value placeholder.
- The fast scroller uses a 48dp by 12dp pill thumb in the theme's primary
  colour, inset 8dp from the edge. The Plugins tab uses the same style.

## Timing logs

- Native: `adb logcat -s LNChapterList`. For each `reset` and `setRows` there's
  one line for how long the call waited for the main thread and one for how
  long it took there. There's also one line from a list reset to the next frame.
- JS: `LNChapterList: build N rows + sync` is a `performance.measure` entry,
  visible in the RN DevTools performance panel and in Perfetto.

## Tests

- JS: `src/components/NativeChapterList/__tests__` (store sync),
  `src/screens/novel/components/__tests__/NovelScreenList.test.tsx` and
  `src/screens/reader/components/ChapterDrawer/__tests__/ChapterDrawer.test.tsx`.
  The global mock is in `test/mocks/nitroChapterList.js`.
- Kotlin: `android/src/test`: `ChapterListModelTest` (store bookkeeping,
  notification ranges, highlight), `ChapterRowFormatterParityTest`,
  `ListMetricsTest` (offsets with and without a header),
  `HighlightVisibilityTest`, `ScrollEventGateTest` and `RangeRequesterTest`. Run it with `./gradlew :nitro-chapter-list:testDebugUnitTest`
  from `android/`.

## Device checklist

Use a release build and a novel with 5,000+ chapters:

- Fling. Fast-scrub top ↔ bottom. Scrub into batches that haven't loaded yet.
- Jump to chapter, the scroll-to-top FAB, the app bar fade.
- Pull-to-refresh, selection mode, download and delete (the native popup).
- Header: every button works, pressing a header button and then dragging cancels
  the press, and the header resizes when the summary expands.
- Theme switch, RTL, large font scale, TalkBack.
- Reader drawer: open it on a chapter deep in the list (no visible jump), fling
  and scrub, change chapters with it open (animated scroll, highlight moves),
  the footer buttons, swipe-to-close over the list.
- Jank: `adb shell dumpsys gfxinfo <package> framestats`, compared against a
  build without this module.

## Open risks (verify on a device)

- **Header hosting.** Fabric keeps laying the header out at the top of the list
  in its shadow tree and never learns that it scrolled. Hit-testing uses native
  views, so taps land correctly. JS `measure()` and Pressable's press-retention
  rect use the shadow tree, though, so they are off by the scroll offset while
  the header is scrolled. Nothing in the header currently measures itself.
- **Reanimated and a custom component's `topScroll`.** This relies on Reanimated
  matching the event by name (`onScroll`), as it does for ScrollView.
