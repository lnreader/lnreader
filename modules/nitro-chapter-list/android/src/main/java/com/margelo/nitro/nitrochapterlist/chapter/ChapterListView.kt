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
      thumb = theme.onSurfaceVariant,
      pressedThumb = theme.primary,
      track = theme.outlineVariant,
      refreshIndicator = theme.primary,
      refreshBackground = theme.onPrimary,
    )
  }

  fun setIsLocal(value: Boolean) {
    adapter.isLocal = value
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
