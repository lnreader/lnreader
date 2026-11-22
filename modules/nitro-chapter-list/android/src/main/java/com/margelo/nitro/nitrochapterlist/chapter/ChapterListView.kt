package com.margelo.nitro.nitrochapterlist.chapter

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Trace
import android.view.Menu
import android.view.HapticFeedbackConstants
import android.view.ViewTreeObserver
import android.widget.PopupMenu
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.nitrochapterlist.ChapterListStoreRegistry
import com.margelo.nitro.nitrochapterlist.HybridChapterListStore
import com.margelo.nitro.nitrochapterlist.core.HighlightVisibility
import com.margelo.nitro.nitrochapterlist.core.ListHostView
import com.margelo.nitro.nitrochapterlist.novel.NovelDetailsChrome
import com.margelo.nitro.nitrochapterlist.novel.NovelDetailsHeader
import com.margelo.nitro.nitrochapterlist.novel.NovelDetailsModel
import com.margelo.nitro.nitrochapterlist.novel.NovelChapterJumpDialog
import com.margelo.nitro.nitrochapterlist.novel.NovelChapterSettingsSheet
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * A chapter list: [ListHostView] with chapter rows from a [HybridChapterListStore].
 * The `novel` variant hosts the Novel screen's header, controls, and chapter
 * rows with pull-to-refresh. The `drawer` variant is the reader's chapter
 * drawer (headerless, drawer rows, a highlighted current chapter reported
 * through `topHighlightedVisibilityChange`, and no scroll events).
 */
@SuppressLint("ViewConstructor")
class ChapterListView(reactContext: ThemedReactContext) :
  ListHostView(
    reactContext,
    (ChapterRowView.ROW_HEIGHT_DP * reactContext.resources.displayMetrics.density).roundToInt(),
  ),
  ChapterListAdapter.Callbacks,
  ChapterListModel.Listener {

  private val adapter = ChapterListAdapter(header, this)
  private var store: HybridChapterListStore? = null
  private var storeId: String? = null
  private var theme = ChapterListTheme()
  private var colors: Map<String, Int> = emptyMap()
  private var strings: Map<String, String> = emptyMap()
  private var resetAtNanos = 0L
  private var drawer = false
  private var isLocalNovel = false
  private var detailsValue: String? = null
  private var details: NovelDetailsModel? = null
  private var detailsHeader: NovelDetailsHeader? = null
  private var detailsChrome: NovelDetailsChrome? = null
  private var detailsDirty = false
  private var selectionResult: Pair<Int, IntArray>? = null
  private var jumpResult: JSONObject? = null
  private var jumpSequence = 0
  private var chapterJump: NovelChapterJumpDialog? = null
  private var chapterSettings: NovelChapterSettingsSheet? = null
  private var chapterSettingsTab = 0
  private val highlightVisibility = HighlightVisibility()
  private var highlightUpdatePosted = false
  private val highlightUpdate = Runnable {
    highlightUpdatePosted = false
    updateHighlightVisibility()
  }
  private var initialPosition = -1
  private var initialPositionApplied = false
  private var propsApplied = false
  private val midnightRefresh = Runnable {
    adapter.refreshText()
    scheduleMidnightRefresh()
  }

  init {
    attachAdapter(adapter)
    // Flings and fast-scroll jumps replace a whole screen of rows at once;
    // keep enough recycled rows that none has to be created mid-scroll.
    recyclerView.recycledViewPool.setMaxRecycledViews(ChapterListAdapter.TYPE_ROW, ROW_POOL_SIZE)
  }

  // --- Props ---

  fun setStoreId(id: String?) {
    if (id == storeId) return
    storeId = id
    store?.model?.removeListener(this)
    store = id?.let { ChapterListStoreRegistry.get(it) }
    details?.selectionKey?.let { store?.model?.setSelectionScope(it) }
    store?.model?.addListener(this)
    adapter.model = store?.model
    onContentChanged()
    applyInitialPosition()
    postHighlightUpdate()
    onSelectionChanged()
  }

  /** `novel` (default) or `drawer`; see the class comment. */
  fun setVariant(value: String?) {
    val isDrawer = value == VARIANT_DRAWER
    if (isDrawer == drawer) return
    drawer = isDrawer
    emitsScrollEvents = !isDrawer && details == null
    adapter.variant = if (isDrawer) ChapterListAdapter.Variant.DRAWER else ChapterListAdapter.Variant.NOVEL
    adapter.headerCount = if (isDrawer) 0 else 1
    setHasHeader(!isDrawer)
    rowHeight =
      if (isDrawer) {
        ChapterRowView.drawerRowHeight(context)
      } else {
        (ChapterRowView.ROW_HEIGHT_DP * resources.displayMetrics.density).roundToInt()
      }
    setRefreshEnabled(!isDrawer)
    recyclerView.recycledViewPool.setMaxRecycledViews(ChapterListAdapter.TYPE_DRAWER_ROW, ROW_POOL_SIZE)
    highlightVisibility.reset()
  }

  /**
   * Row the list opens at (at the top), applied once, before the first layout
   * that has rows, so it never visibly jumps there. Negative: the top.
   */
  fun setInitialPosition(value: Int) {
    if (initialPositionApplied) return
    initialPosition = value
    applyInitialPosition()
  }

  /** The first prop update is complete, so the variant (and header count) is known. */
  fun onPropsApplied() {
    propsApplied = true
    applyInitialPosition()
    if (detailsDirty) {
      detailsDirty = false
      applyNovelDetails()
    }
    selectionResult?.let { (request, ids) -> store?.model?.completeSelectAll(request, ids) }
    selectionResult = null
    jumpResult?.let { chapterJump?.accept(it) }
    jumpResult = null
  }

  fun setJumpResult(value: String?) {
    jumpResult = value?.let(::JSONObject)
  }

  fun setSelectionResult(request: Int, ids: IntArray) {
    selectionResult = request to ids
  }

  fun setNovelDetails(value: String?) {
    if (detailsValue == value) return
    val next = value?.let { NovelDetailsModel(JSONObject(it)) }
    if (details?.chapterControlScope != next?.chapterControlScope) chapterJump?.dismiss()
    detailsValue = value
    details = next
    emitsScrollEvents = !drawer && details == null
    detailsDirty = true
  }

  private fun applyNovelDetails() {
    val model = details
    if (model == null) {
      detailsHeader?.dispose()
      detailsHeader = null
      header.setNativeChild(null)
      detailsChrome?.let(::removeView)
      detailsChrome = null
      return
    }

    Trace.beginSection("LNReader Novel Details bind")
    try {
      model.selectionKey?.let { store?.model?.setSelectionScope(it) }
      val nativeHeader = detailsHeader ?: NovelDetailsHeader(reactContext, ::onNovelAction).also {
        detailsHeader = it
        header.setNativeChild(it)
      }
      val chrome = detailsChrome ?: NovelDetailsChrome(reactContext, ::onNovelAction) {
        scrollToOffset(0f, details?.reduceMotion != true)
      }.also {
        detailsChrome = it
        addView(it, FrameLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
      }
      setBackgroundColor(model.background)
      nativeHeader.bind(model, theme)
      chrome.bind(model, theme)
      onSelectionChanged()
    } finally {
      Trace.endSection()
    }
  }

  private fun onNovelAction(action: String) {
    if (action == "filter" && details?.chapterSettings != null) {
      showChapterSettings()
      return
    }
    if (action == "jump" && details?.chapterJump != null) {
      showChapterJump()
      return
    }
    val model = store?.model
    if (model != null && details?.selectionKey != null) {
      when {
        action == "clear-selection" -> {
          model.clearSelection()
          return
        }
        action == "select-all" -> {
          if (model.selectionCount > 0) {
            val request = model.requestSelectAll()
            dispatch(ChapterListEvents.NOVEL_ACTION, Arguments.createMap().apply {
              putString("action", action)
              putInt("requestId", request)
            })
          }
          return
        }
        action.startsWith("selection-") -> {
          if (model.selectionCount == 0) return
          val ids = model.selectionIds()
          val onlyLoaded = model.selectionSummary().onlyLoaded
          dispatch(ChapterListEvents.NOVEL_ACTION, Arguments.createMap().apply {
            putString("action", action)
            putArray("selectedIds", Arguments.createArray().apply { ids.forEach(::pushInt) })
            onlyLoaded?.let { putInt("chapterId", it.id.toInt()) }
          })
          model.clearSelection()
          return
        }
      }
    }
    dispatch(ChapterListEvents.NOVEL_ACTION, Arguments.createMap().apply { putString("action", action) })
  }

  private fun showChapterSettings() {
    if (chapterSettings != null) return
    val activity = reactContext.currentActivity ?: return
    val details = details ?: return
    val config = details.chapterSettings ?: return
    chapterSettings = NovelChapterSettingsSheet(activity, chapterSettingsTab, config, details, theme,
      onChange = { key, value, values ->
        dispatch(ChapterListEvents.NOVEL_ACTION, Arguments.createMap().apply {
          putString("action", "chapter-settings-$key")
          value?.let { putString("value", it) }
          values?.let { putArray("values", Arguments.createArray().apply { it.forEach(::pushString) }) }
        })
      },
      onDismiss = { tab ->
        chapterSettingsTab = tab
        chapterSettings = null
      },
    ).also { it.show() }
  }

  private fun showChapterJump() {
    if (chapterJump != null) return
    val activity = reactContext.currentActivity ?: return
    val details = details ?: return
    val config = details.chapterJump ?: return
    chapterJump = NovelChapterJumpDialog(activity, config, details, theme,
      nextRequest = { ++jumpSequence },
      onSearch = { request, query, byName ->
        dispatch(ChapterListEvents.NOVEL_ACTION, Arguments.createMap().apply {
          putString("action", "chapter-jump-search")
          putInt("requestId", request)
          putString("value", query)
          putBoolean("byName", byName)
        })
      },
      onChoose = { request, chapterId, open ->
        val position = store?.model?.positionOf(chapterId) ?: -1
        if (!open && position >= 0) {
          scrollToJumpTarget(position)
        } else {
          dispatch(ChapterListEvents.NOVEL_ACTION, Arguments.createMap().apply {
            putString("action", if (open) "chapter-jump-open" else "chapter-jump-scroll")
            putInt("requestId", request)
            putInt("chapterId", chapterId)
          })
          open
        }
      },
      onScroll = ::scrollToJumpTarget,
      onDismiss = { chapterJump = null },
    ).also { it.show() }
  }

  private fun scrollToJumpTarget(index: Int): Boolean {
    val count = store?.model?.count ?: return false
    if (index !in 0 until count) return false
    scrollToIndex(index, details?.reduceMotion != true, 0.5f)
    return true
  }

  private fun applyInitialPosition() {
    if (!propsApplied || initialPositionApplied || initialPosition < 0) return
    val count = store?.model?.count ?: return
    if (count == 0) return
    recyclerView.scrollToRowBeforeLayout(initialPosition.coerceAtMost(count - 1))
    initialPositionApplied = true
  }

  fun setColors(value: Map<String, Int>) {
    colors = value
    applyTheme()
  }

  fun setStrings(value: Map<String, String>) {
    strings = value
    applyTheme()
  }

  private fun applyTheme() {
    val defaults = ChapterListTheme()
    fun color(key: String, fallback: Int) = colors[key] ?: fallback
    fun string(key: String, fallback: String) = strings[key] ?: fallback
    theme =
      ChapterListTheme(
        onSurface = color("onSurface", defaults.onSurface),
        onSurfaceVariant = color("onSurfaceVariant", defaults.onSurfaceVariant),
        outline = color("outline", defaults.outline),
        outlineVariant = color("outlineVariant", defaults.outlineVariant),
        primary = color("primary", defaults.primary),
        onPrimary = color("onPrimary", defaults.onPrimary),
        rippleColor = color("rippleColor", defaults.rippleColor),
        surface = color("surface", defaults.surface),
        selectedBackground = color("selectedBackground", defaults.selectedBackground),
        secondaryContainer = color("secondaryContainer", defaults.secondaryContainer),
        onSecondaryContainer = color("onSecondaryContainer", defaults.onSecondaryContainer),
        deleteLabel = string("deleteLabel", defaults.deleteLabel),
        downloadA11yLabel = string("downloadA11yLabel", defaults.downloadA11yLabel),
        deleteA11yLabel = string("deleteA11yLabel", defaults.deleteA11yLabel),
        downloadingA11yLabel = string("downloadingA11yLabel", defaults.downloadingA11yLabel),
      )
    adapter.theme = theme
    if (details != null) detailsDirty = true
    setListColors(
      thumb = theme.primary,
      // Pressed: the thumb darkens (light theme) or lightens (dark) a little.
      pressedThumb = blend(theme.primary, theme.onSurface, PRESSED_THUMB_BLEND),
      refreshIndicator = theme.primary,
      refreshBackground = theme.onPrimary,
    )
  }

  fun setIsLocal(value: Boolean) {
    isLocalNovel = value
    adapter.isLocal = value
    onSelectionChanged()
  }

  fun setRowFormat(value: ChapterRowFormat) {
    if (value == adapter.formatter.format) return
    adapter.formatter = ChapterRowFormatter(value)
  }

  // Relative dates ("Today", "Last Monday") are worked out at bind time; rebind
  // the visible rows when the day changes so they don't go stale on screen.
  // A time zone change moves calendar days (and the formatter keeps the zone
  // it was built with); a clock change can move "today".
  private val clockReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_TIMEZONE_CHANGED) {
          adapter.formatter = ChapterRowFormatter(adapter.formatter.format)
        } else {
          adapter.refreshText()
        }
        scheduleMidnightRefresh()
      }
    }
  private var clockReceiverRegistered = false

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    scheduleMidnightRefresh()
    if (!clockReceiverRegistered) {
      val filter =
        IntentFilter().apply {
          addAction(Intent.ACTION_TIMEZONE_CHANGED)
          addAction(Intent.ACTION_TIME_CHANGED)
        }
      // Both are system broadcasts, which non-exported receivers still get.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.applicationContext.registerReceiver(clockReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        context.applicationContext.registerReceiver(clockReceiver, filter)
      }
      clockReceiverRegistered = true
    }
  }

  override fun onDetachedFromWindow() {
    chapterSettings?.dismiss()
    chapterJump?.dismiss()
    removeCallbacks(midnightRefresh)
    if (clockReceiverRegistered) {
      context.applicationContext.unregisterReceiver(clockReceiver)
      clockReceiverRegistered = false
    }
    super.onDetachedFromWindow()
  }

  private fun scheduleMidnightRefresh() {
    removeCallbacks(midnightRefresh)
    val now = java.util.Calendar.getInstance()
    val next =
      (now.clone() as java.util.Calendar).apply {
        add(java.util.Calendar.DAY_OF_MONTH, 1)
        set(java.util.Calendar.HOUR_OF_DAY, 0)
        set(java.util.Calendar.MINUTE, 0)
        set(java.util.Calendar.SECOND, 1)
        set(java.util.Calendar.MILLISECOND, 0)
      }
    postDelayed(midnightRefresh, next.timeInMillis - now.timeInMillis)
  }

  // --- Adapter callbacks ---

  override fun onChapterPress(id: Int, position: Int) {
    val model = store?.model
    if (!drawer && details?.selectionKey != null && model != null && model.selectionCount > 0) {
      model.toggleSelection(id)
    } else {
      dispatchRow(ChapterListEvents.CHAPTER_PRESS, id, position)
    }
  }

  override fun onChapterLongPress(id: Int, position: Int) {
    val model = store?.model
    val details = details
    if (!drawer && details?.selectionKey != null && model != null) {
      if (model.selectionCount == 0 && details.selectionHaptics) {
        performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
      }
      model.extendSelection(id)
    } else {
      dispatchRow(ChapterListEvents.CHAPTER_LONG_PRESS, id, position)
    }
  }

  override fun onDownloadPress(id: Int, position: Int) = dispatchRow(ChapterListEvents.DOWNLOAD_PRESS, id, position)

  override fun onDeleteMenuRequested(id: Int, position: Int, anchor: ChapterRowView) {
    PopupMenu(context, anchor.downloadButton).apply {
      menu.add(Menu.NONE, MENU_DELETE, Menu.NONE, theme.deleteLabel)
      setOnMenuItemClickListener {
        dispatchRow(ChapterListEvents.DELETE_PRESS, id, position)
        true
      }
      show()
    }
  }

  override fun onPlaceholderBound(position: Int) {
    val model = store?.model ?: return
    requestRangeFor(position, model.count, model.generation)
  }

  // --- Model listener: keep scroll metrics in step with the row count ---

  override fun onReset() {
    onContentChanged()
    applyInitialPosition()
    highlightVisibility.reset()
    postHighlightUpdate()
    logFirstDrawAfterReset()
    onSelectionChanged()
  }

  // Loaded rows (and setHighlighted) can make the highlighted position known.
  override fun onRangeChanged(start: Int, count: Int, payload: Any?) {
    if (payload == null || payload === ChapterListModel.Payload.HIGHLIGHT) postHighlightUpdate()
    if (payload == null && (store?.model?.selectionCount ?: 0) > 0) onSelectionChanged()
  }

  override fun onRangeInserted(start: Int, count: Int) {
    onContentChanged()
    applyInitialPosition()
    postHighlightUpdate()
    if ((store?.model?.selectionCount ?: 0) > 0) onSelectionChanged()
  }

  override fun onSelectionChanged() {
    val chrome = detailsChrome ?: return
    val model = store?.model
    chrome.updateSelection(model?.selectionSummary() ?: ChapterSelectionSummary(), theme, isLocalNovel)
  }

  // --- Highlighted row visibility (drawer) ---

  override fun onVisibleRangeChanged() {
    updateHighlightVisibility()
    detailsChrome?.updateScroll(recyclerView.computeVerticalScrollOffset(), recyclerView.height)
  }

  /** After the layout pass the model change scheduled, so the visible rows are current. */
  private fun postHighlightUpdate() {
    if (!drawer || highlightUpdatePosted) return
    highlightUpdatePosted = true
    post(highlightUpdate)
  }

  private fun updateHighlightVisibility() {
    if (!drawer) return
    val model = store?.model ?: return
    val state =
      highlightVisibility.update(firstVisibleRow(), lastVisibleRow(), model.highlightedPosition) ?: return
    dispatch(
      ChapterListEvents.HIGHLIGHTED_VISIBILITY_CHANGE,
      Arguments.createMap().apply { putString("state", state.jsName) },
    )
  }

  private fun logFirstDrawAfterReset() {
    resetAtNanos = ChapterListPerf.now()
    val observer = viewTreeObserver
    observer.addOnPreDrawListener(
      object : ViewTreeObserver.OnPreDrawListener {
        override fun onPreDraw(): Boolean {
          if (viewTreeObserver.isAlive) viewTreeObserver.removeOnPreDrawListener(this)
          ChapterListPerf.log("list reset -> first frame", resetAtNanos)
          return true
        }
      },
    )
  }

  private fun dispatchRow(name: String, chapterId: Int, position: Int) {
    dispatch(
      name,
      Arguments.createMap().apply {
        putInt("id", chapterId)
        putInt("position", position)
      },
    )
  }

  /**
   * The view is being dropped, often while its screen animates away. Only stop
   * listening: notifying the adapter here would schedule a layout pass of a
   * list that's about to disappear.
   */
  fun dispose() {
    detailsHeader?.dispose()
    store?.model?.removeListener(this)
    adapter.detachModel()
    removeCallbacks(midnightRefresh)
    removeCallbacks(highlightUpdate)
    store = null
  }

  private companion object {
    const val MENU_DELETE = 1
    const val ROW_POOL_SIZE = 32
    const val PRESSED_THUMB_BLEND = 0.3f
    const val VARIANT_DRAWER = "drawer"

    fun blend(from: Int, to: Int, ratio: Float): Int {
      fun channel(shift: Int): Int {
        val a = (from shr shift) and 0xFF
        val b = (to shr shift) and 0xFF
        return (a + (b - a) * ratio).roundToInt() and 0xFF
      }
      return (channel(24) shl 24) or (channel(16) shl 16) or (channel(8) shl 8) or channel(0)
    }
  }
}

/** Chapter row events (direct events, mapped to their JS props). */
object ChapterListEvents {
  const val NOVEL_ACTION = "topNovelAction"
  const val CHAPTER_PRESS = "topChapterPress"
  const val CHAPTER_LONG_PRESS = "topChapterLongPress"
  const val DOWNLOAD_PRESS = "topDownloadPress"
  const val DELETE_PRESS = "topDeletePress"
  const val HIGHLIGHTED_VISIBILITY_CHANGE = "topHighlightedVisibilityChange"

  val registrationNames =
    mapOf(
      CHAPTER_PRESS to "onChapterPress",
      NOVEL_ACTION to "onNovelAction",
      CHAPTER_LONG_PRESS to "onChapterLongPress",
      DOWNLOAD_PRESS to "onDownloadPress",
      DELETE_PRESS to "onDeletePress",
      HIGHLIGHTED_VISIBILITY_CHANGE to "onHighlightedVisibilityChange",
    )
}
