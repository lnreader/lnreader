package com.margelo.nitro.nitrochapterlist

import android.annotation.SuppressLint
import android.view.Menu
import android.view.View
import android.widget.FrameLayout
import android.widget.PopupMenu
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.facebook.react.views.scroll.ScrollEvent
import com.facebook.react.views.scroll.ScrollEventType
import com.facebook.react.views.swiperefresh.ReactSwipeRefreshLayout
import kotlin.math.roundToInt

/**
 * Root of the native chapter list: SwipeRefreshLayout > RecyclerView, with the
 * React header as item 0 and [ChapterFastScroller] drawn over the rows.
 */
@SuppressLint("ViewConstructor")
class ChapterListView(private val reactContext: ThemedReactContext) :
  FrameLayout(reactContext), ChapterListAdapter.Callbacks, ChapterListModel.Listener {

  val header = HeaderContainer(reactContext)
  private val recyclerView = ChapterRecyclerView(reactContext, header)
  private val swipeRefresh = ReactSwipeRefreshLayout(reactContext)
  private val adapter = ChapterListAdapter(header, this)
  private val fastScroller = ChapterFastScroller(recyclerView)

  private var store: HybridChapterListStore? = null
  private var storeId: String? = null
  private var theme = ChapterListTheme()
  private var colors: Map<String, Int> = emptyMap()
  private var strings: Map<String, String> = emptyMap()

  var batchSize: Int = 1000
  private val requestedBatches = HashSet<Int>()
  private var requestedGeneration = -1

  // False while FrameLayout's constructor runs, before our fields exist.
  private var initialized = false
  private var layoutPosted = false
  private val measureAndLayout = Runnable {
    layoutPosted = false
    measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
    layout(left, top, right, bottom)
  }

  init {
    recyclerView.adapter = adapter
    swipeRefresh.addView(recyclerView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    addView(swipeRefresh, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    swipeRefresh.setOnRefreshListener { dispatch(ChapterListEvent.REFRESH, Arguments.createMap()) }
    recyclerView.addOnScrollListener(
      object : RecyclerView.OnScrollListener() {
        override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
          dispatchScroll()
        }
      },
    )
    header.onContentHeightChanged = {
      fastScroller.onContentChanged()
      dispatchScroll()
    }
    initialized = true
  }

  // RN lays this view out from Yoga and swallows requestLayout from native
  // children, so run their measure/layout pass ourselves on the next frame.
  override fun requestLayout() {
    super.requestLayout()
    if (initialized && !layoutPosted) {
      layoutPosted = true
      post(measureAndLayout)
    }
  }

  // --- React children (the header) ---

  fun setHeaderChild(child: View?) {
    header.setReactChild(child)
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
    fastScroller.setColors(theme.onSurfaceVariant, theme.primary, theme.outlineVariant)
    swipeRefresh.setColorSchemeColors(theme.primary)
    swipeRefresh.setProgressBackgroundColorSchemeColor(theme.onPrimary)
  }

  fun setIsLocal(value: Boolean) {
    adapter.isLocal = value
  }

  fun setRefreshing(value: Boolean) {
    swipeRefresh.isRefreshing = value
  }

  fun setRefreshOffset(dp: Float) {
    swipeRefresh.setProgressViewOffset(dp)
  }

  fun setContentPaddingBottom(dp: Float) {
    val px = PixelUtil.toPixelFromDIP(dp).roundToInt()
    if (recyclerView.paddingBottom == px) return
    recyclerView.setPadding(0, 0, 0, px)
    onContentChanged()
  }

  var fastScrollTopInset: Float = 0f
    set(dp) {
      field = dp
      fastScroller.topInset = PixelUtil.toPixelFromDIP(dp).roundToInt()
      fastScroller.onContentChanged()
    }

  var fastScrollBottomInset: Float = 0f
    set(dp) {
      field = dp
      fastScroller.bottomInset = PixelUtil.toPixelFromDIP(dp).roundToInt()
      fastScroller.onContentChanged()
    }

  // --- Commands ---

  fun scrollToIndex(index: Int, animated: Boolean, viewPosition: Float) {
    recyclerView.scrollToOffset(recyclerView.offsetForIndex(index, viewPosition), animated)
  }

  fun scrollToOffset(offsetDp: Float, animated: Boolean) {
    recyclerView.scrollToOffset(PixelUtil.toPixelFromDIP(offsetDp).roundToInt(), animated)
  }

  // --- Adapter callbacks ---

  override fun onChapterPress(id: Int) = dispatchId(ChapterListEvent.CHAPTER_PRESS, id)

  override fun onChapterLongPress(id: Int) = dispatchId(ChapterListEvent.CHAPTER_LONG_PRESS, id)

  override fun onDownloadPress(id: Int) = dispatchId(ChapterListEvent.DOWNLOAD_PRESS, id)

  override fun onDeleteMenuRequested(id: Int, anchor: ChapterRowView) {
    PopupMenu(context, anchor.downloadButton).apply {
      menu.add(Menu.NONE, MENU_DELETE, Menu.NONE, theme.deleteLabel)
      setOnMenuItemClickListener {
        dispatchId(ChapterListEvent.DELETE_PRESS, id)
        true
      }
      show()
    }
  }

  override fun onPlaceholderBound(position: Int) {
    val model = store?.model ?: return
    if (model.generation != requestedGeneration) {
      requestedGeneration = model.generation
      requestedBatches.clear()
    }
    val batch = position / batchSize
    if (!requestedBatches.add(batch)) return
    val start = batch * batchSize
    val end = minOf(model.count, start + batchSize) - 1
    dispatch(
      ChapterListEvent.REQUEST_RANGE,
      Arguments.createMap().apply {
        putInt("start", start)
        putInt("end", end)
      },
    )
  }

  // --- Model listener: keep scroll metrics in step with the row count ---

  override fun onReset() = onContentChanged()

  override fun onRangeChanged(start: Int, count: Int, payload: Any?) {}

  override fun onRangeInserted(start: Int, count: Int) = onContentChanged()

  private fun onContentChanged() {
    fastScroller.onContentChanged()
    dispatchScroll()
  }

  // --- Events ---

  private val surfaceId: Int
    get() = UIManagerHelper.getSurfaceId(this)

  private fun dispatchEvent(event: Event<*>) {
    UIManagerHelper.getEventDispatcher(reactContext)?.dispatchEvent(event)
  }

  private fun dispatch(name: String, data: WritableMap) {
    dispatchEvent(ChapterListEvent(surfaceId, id, name, data))
  }

  private fun dispatchId(name: String, chapterId: Int) {
    dispatch(name, Arguments.createMap().apply { putInt("id", chapterId) })
  }

  /** ScrollView-shaped `topScroll`, which Reanimated handles on the UI thread. */
  private fun dispatchScroll() {
    if (id == NO_ID) return
    dispatchEvent(
      ScrollEvent.obtain(
        surfaceId,
        id,
        ScrollEventType.SCROLL,
        0f,
        recyclerView.computeVerticalScrollOffset().toFloat(),
        0f,
        0f,
        recyclerView.width,
        recyclerView.contentHeight,
        recyclerView.width,
        recyclerView.height,
      ),
    )
  }

  fun dispose() {
    store?.model?.removeListener(this)
    adapter.model = null
    store = null
  }

  private companion object {
    const val MENU_DELETE = 1
  }
}
