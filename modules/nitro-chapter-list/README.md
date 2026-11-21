# nitro-chapter-list

A native Android `RecyclerView` chapter list for the novel screen. It replaces the
React-rendered list so scrolling, flinging and fast-scrubbing through 10,000+
chapters does no JS work per frame.

Android only.

## Layout

The Kotlin code (`android/src/main/java/com/margelo/nitro/nitrochapterlist`) is
split so another screen can reuse the list without the chapter parts:

| Package   | What                                                   | Files                                                                                                                                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`    | Generic native list host, knows nothing about chapters | `ListHostView` (SwipeRefreshLayout > RecyclerView, header item, events, commands), `ListHostViewManager` (hosting the React header child), `ListRecyclerView` (exact metrics, jumps), `ListFastScroller` (fork of androidx `FastScroller`, Apache 2.0), `HeaderContainer`, `ScrollEventGate`, `RangeRequester`, `ListEvent` |
| `chapter` | The chapter list on top of `core`                      | `ChapterListView`, `ChapterListAdapter`, `ChapterRowView`, `IconView`, `ChapterListModel` (rows, selection, downloading), `ChapterListPerf`                                                                                                                                                                                 |
| root      | Entry points that Nitro and RN look up by name         | `HybridChapterListStore` (the Nitro store), `ChapterListStoreRegistry`, `ChapterListViewManager` (`LNChapterListView`), `NitroChapterListPackage`                                                                                                                                                                           |

A new list type adds its own package with a `ListHostView` subclass, adapter,
row view and Nitro store, plus a Fabric spec and view manager. It reuses `core`
unchanged.

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

## Maintenance

**Every change to how a chapter row looks or behaves on the novel screen is now
Kotlin work** in `ChapterRowView.kt` and `ChapterListAdapter.kt`, plus the strings
in `buildChapterRow` (`src/components/NativeChapterList/chapterListSync.ts`).
`ChapterItem.tsx` still renders rows elsewhere in the app, so keep the two in step.

After changing `src/specs/*.nitro.ts`, regenerate the bindings:

```sh
cd modules/nitro-chapter-list && npx nitrogen
```

React Native codegen for `src/fabric` runs as part of the Android build.

## Known differences from `ChapterItem`

- The subtitle is one string, so the reading-progress part uses the subtitle
  colour. `ChapterItem` draws it in `outline`.
- The gap between subtitle parts is the text `" •  "`. `ChapterItem` uses a 5dp
  margin before `"•  "`.

## Timing logs

- Native: `adb logcat -s LNChapterList`. For each `reset` and `setRows` there's
  one line for how long the call waited for the main thread and one for how
  long it took there. There's also one line from a list reset to the next frame.
- JS: `LNChapterList: build N rows + sync` is a `performance.measure` entry,
  visible in the RN DevTools performance panel and in Perfetto.

## Tests

- JS: `src/components/NativeChapterList/__tests__` (store sync) and
  `src/screens/novel/components/__tests__/NovelScreenList.test.tsx`. The global
  mock is in `test/mocks/nitroChapterList.js`.
- Kotlin: `android/src/test`: `ChapterListModelTest` (store bookkeeping and
  notification ranges), `ScrollEventGateTest` and `RangeRequesterTest`. Run it with `./gradlew :nitro-chapter-list:testDebugUnitTest`
  from `android/`.

## Device checklist

Use a release build and a novel with 5,000+ chapters:

- Fling. Fast-scrub top ↔ bottom. Scrub into batches that haven't loaded yet.
- Jump to chapter, the scroll-to-top FAB, the app bar fade.
- Pull-to-refresh, selection mode, download and delete (the native popup).
- Header: every button works, pressing a header button and then dragging cancels
  the press, and the header resizes when the summary expands.
- Theme switch, RTL, large font scale, TalkBack.
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
