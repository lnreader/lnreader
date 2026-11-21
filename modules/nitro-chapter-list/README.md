# nitro-chapter-list

A native Android `RecyclerView` chapter list for the novel screen. It replaces the
React-rendered list so scrolling, flinging and fast-scrubbing through 10,000+
chapters does no JS work per frame.

Android only.

## Pieces

| Piece | Where | Role |
|---|---|---|
| `ChapterListStore` (Nitro HybridObject) | `src/specs`, `HybridChapterListStore.kt`, `ChapterListModel.kt` | Bulk row data, selection and downloading state. JS writes and native reads. Each JS call is copied and applied in one main-thread post, which produces the smallest set of `notifyItemRange*` calls. |
| `LNChapterListView` (Fabric codegen component) | `src/fabric`, `ChapterListViewManager.kt`, `ChapterListView.kt` | `SwipeRefreshLayout` > `RecyclerView`. Its single React child (the novel header) is placed in the RecyclerView's header item, the way `react-native-pager-view` hosts its pages. |
| Rows | `ChapterRowView.kt`, `IconView.kt` | Built in code with a custom measure and layout, 64dp tall. Icons come from the same `MaterialDesignIcons.ttf` that the RN app loads. |
| Fast scroller | `ChapterFastScroller.kt` | A fork of androidx `FastScroller` (Apache 2.0). See the class comment for what changed. |
| JS wrapper | `src/components/NativeChapterList` in the app | `useChapterListStore()` syncs the novel store into the native store, and `<NativeChapterList>` wraps the view and the ref. |

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
Reanimated still forwards each event to an empty JS listener, which is the same
cost a ScrollView with an animated scroll handler pays.

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

## Tests

- JS: `src/components/NativeChapterList/__tests__` (store sync) and
  `src/screens/novel/components/__tests__/NovelScreenList.test.tsx`. The global
  mock is in `test/mocks/nitroChapterList.js`.
- Kotlin: `android/src/test` (`ChapterListModelTest`, store bookkeeping and
  notification ranges). Run it with `./gradlew :nitro-chapter-list:testDebugUnitTest`
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
