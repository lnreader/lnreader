package com.margelo.nitro.nitrochapterlist.chapter

import android.annotation.SuppressLint
import android.view.Menu
import android.view.ViewTreeObserver
import android.widget.PopupMenu
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.nitrochapterlist.ChapterListStoreRegistry
import com.margelo.nitro.nitrochapterlist.HybridChapterListStore
import com.margelo.nitro.nitrochapterlist.core.ListHostView
import kotlin.math.roundToInt

/** The novel screen's chapter list: [ListHostView] with chapter rows from a [HybridChapterListStore]. */
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
    store?.model?.addListener(this)
    adapter.model = store?.model
    onContentChanged()
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
        deleteLabel = string("deleteLabel", defaults.deleteLabel),
        downloadA11yLabel = string("downloadA11yLabel", defaults.downloadA11yLabel),
        deleteA11yLabel = string("deleteA11yLabel", defaults.deleteA11yLabel),
        downloadingA11yLabel = string("downloadingA11yLabel", defaults.downloadingA11yLabel),
      )
    adapter.theme = theme
    setListColors(
      thumb = theme.primary,
      // Pressed: the thumb darkens (light theme) or lightens (dark) a little.
      pressedThumb = blend(theme.primary, theme.onSurface, PRESSED_THUMB_BLEND),
      refreshIndicator = theme.primary,
      refreshBackground = theme.onPrimary,
    )
  }

  fun setIsLocal(value: Boolean) {
    adapter.isLocal = value
  }

  fun setRowFormat(value: ChapterRowFormat) {
    if (value == adapter.formatter.format) return
    adapter.formatter = ChapterRowFormatter(value)
  }

  // Relative dates ("Today", "Last Monday") are worked out at bind time; rebind
  // the visible rows when the day changes so they don't go stale on screen.
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    scheduleMidnightRefresh()
  }

  override fun onDetachedFromWindow() {
    removeCallbacks(midnightRefresh)
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

  override fun onChapterPress(id: Int, position: Int) = dispatchRow(ChapterListEvents.CHAPTER_PRESS, id, position)

  override fun onChapterLongPress(id: Int, position: Int) =
    dispatchRow(ChapterListEvents.CHAPTER_LONG_PRESS, id, position)

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
    logFirstDrawAfterReset()
  }

  override fun onRangeChanged(start: Int, count: Int, payload: Any?) {}

  override fun onRangeInserted(start: Int, count: Int) = onContentChanged()

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

  fun dispose() {
    store?.model?.removeListener(this)
    adapter.model = null
    store = null
  }

  private companion object {
    const val MENU_DELETE = 1
    const val ROW_POOL_SIZE = 32
    const val PRESSED_THUMB_BLEND = 0.3f

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
  const val CHAPTER_PRESS = "topChapterPress"
  const val CHAPTER_LONG_PRESS = "topChapterLongPress"
  const val DOWNLOAD_PRESS = "topDownloadPress"
  const val DELETE_PRESS = "topDeletePress"

  val registrationNames =
    mapOf(
      CHAPTER_PRESS to "onChapterPress",
      CHAPTER_LONG_PRESS to "onChapterLongPress",
      DOWNLOAD_PRESS to "onDownloadPress",
      DELETE_PRESS to "onDeletePress",
    )
}
