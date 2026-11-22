package com.margelo.nitro.nitrochapterlist.core

import android.annotation.SuppressLint
import android.view.View
import android.widget.FrameLayout
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
 * Generic host for a native list in React Native: SwipeRefreshLayout >
 * [ListRecyclerView], with the React child as the header item (position 0),
 * [ListFastScroller] over the rows, gated ScrollView-shaped scroll events,
 * range requests for unloaded rows, and scroll commands.
 *
 * Subclasses supply the adapter (the header item at position 0 when
 * [headerCount] is 1, then rows of [rowHeight] px; rows from position 0 when
 * headerless) and their own row events.
 */
@SuppressLint("ViewConstructor")
abstract class ListHostView(
  protected val reactContext: ThemedReactContext,
  rowHeight: Int,
  emitsScrollEvents: Boolean = true,
) : FrameLayout(reactContext) {
  val header = HeaderContainer(reactContext)
  protected val recyclerView = ListRecyclerView(reactContext, header, rowHeight)
  private val swipeRefresh = ReactSwipeRefreshLayout(reactContext)
  private val fastScroller = ListFastScroller(recyclerView)
  private val scrollGate = ScrollEventGate()
  private val rangeRequester = RangeRequester()

  /** False: no `topScroll` events at all (JS doesn't listen). */
  protected var emitsScrollEvents: Boolean = emitsScrollEvents
    set(value) {
      field = value
      scrollGate.reset()
    }

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
    swipeRefresh.addView(recyclerView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    addView(swipeRefresh, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    swipeRefresh.setOnRefreshListener { dispatch(ListEvent.REFRESH, Arguments.createMap()) }
    recyclerView.addOnScrollListener(
      object : RecyclerView.OnScrollListener() {
        // Also called with 0, 0 after a layout changes the visible range.
        override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
          dispatchScroll()
          onVisibleRangeChanged()
        }
      },
    )
    header.onContentHeightChanged = { onContentChanged() }
    initialized = true
  }

  protected fun attachAdapter(adapter: RecyclerView.Adapter<*>) {
    recyclerView.adapter = adapter
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

  fun setHeaderChild(child: View?) {
    header.setReactChild(child)
  }

  /** 1 when position 0 is the header item, 0 when headerless. */
  val headerCount: Int
    get() = recyclerView.headerCount

  /**
   * Headerless lists have no header item: rows start at position 0 and the
   * header's height never counts. The adapter must switch along with this.
   */
  protected fun setHasHeader(value: Boolean) {
    val count = if (value) 1 else 0
    if (recyclerView.metrics.headerCount == count) return
    recyclerView.metrics.headerCount = count
    onContentChanged()
  }

  protected var rowHeight: Int
    get() = recyclerView.rowHeight
    set(value) {
      if (recyclerView.rowHeight == value) return
      recyclerView.rowHeight = value
      onContentChanged()
    }

  // --- Props ---

  protected fun setListColors(
    thumb: Int,
    pressedThumb: Int,
    refreshIndicator: Int,
    refreshBackground: Int,
  ) {
    fastScroller.setColors(thumb, pressedThumb)
    swipeRefresh.setColorSchemeColors(refreshIndicator)
    swipeRefresh.setProgressBackgroundColorSchemeColor(refreshBackground)
  }

  fun setRefreshing(value: Boolean) {
    swipeRefresh.isRefreshing = value
  }

  protected fun setRefreshEnabled(enabled: Boolean) {
    swipeRefresh.isEnabled = enabled
  }

  protected fun setOnRefreshListener(listener: () -> Unit) {
    swipeRefresh.setOnRefreshListener(listener)
  }

  fun setRefreshOffset(dp: Float) {
    swipeRefresh.setProgressViewOffset(dp)
  }

  fun setContentPaddingTop(dp: Float) {
    val px = toPx(dp)
    if (recyclerView.paddingTop == px) return
    recyclerView.setPadding(0, px, 0, recyclerView.paddingBottom)
    onContentChanged()
  }

  fun setContentPaddingBottom(dp: Float) {
    val px = toPx(dp)
    if (recyclerView.paddingBottom == px) return
    recyclerView.setPadding(0, recyclerView.paddingTop, 0, px)
    onContentChanged()
  }

  var fastScrollTopInset: Float = 0f
    set(dp) {
      field = dp
      fastScroller.topInset = toPx(dp)
      fastScroller.onContentChanged()
    }

  var fastScrollBottomInset: Float = 0f
    set(dp) {
      field = dp
      fastScroller.bottomInset = toPx(dp)
      fastScroller.onContentChanged()
    }

  var batchSize: Int
    get() = rangeRequester.batchSize
    set(value) {
      rangeRequester.batchSize = value
    }

  /** Scroll events go out on every change up to this offset (dp); negative: always. */
  fun setScrollEventMaxOffset(dp: Float) {
    scrollGate.continuousUntil = if (dp < 0f) -1f else PixelUtil.toPixelFromDIP(dp)
    scrollGate.reset()
  }

  /** Past the max offset, scroll events only go out when crossing one of these (dp). */
  fun setScrollEventThresholds(dp: FloatArray) {
    scrollGate.thresholds = FloatArray(dp.size) { PixelUtil.toPixelFromDIP(dp[it]) }
    scrollGate.reset()
  }

  // --- Commands ---

  fun scrollToIndex(index: Int, animated: Boolean, viewPosition: Float) {
    recyclerView.scrollToOffset(recyclerView.offsetForIndex(index, viewPosition), animated)
  }

  fun scrollToOffset(offsetDp: Float, animated: Boolean) {
    recyclerView.scrollToOffset(toPx(offsetDp), animated)
  }

  // --- For subclasses ---

  /** Call when a placeholder row binds; asks JS for its batch once. */
  protected fun requestRangeFor(position: Int, count: Int, generation: Int) {
    val range = rangeRequester.onPlaceholderBound(position, count, generation) ?: return
    dispatch(
      ListEvent.REQUEST_RANGE,
      Arguments.createMap().apply {
        putInt("start", range.first)
        putInt("end", range.last)
      },
    )
  }

  /** Called after every scroll, and after layouts that change the visible rows. */
  protected open fun onVisibleRangeChanged() {}

  /** First and last (partly) visible row indices (header excluded), or -1. */
  protected fun firstVisibleRow(): Int = recyclerView.firstVisibleRow()

  protected fun lastVisibleRow(): Int = recyclerView.lastVisibleRow()

  /** Call when the row count or anything else affecting scroll metrics changes. */
  protected fun onContentChanged() {
    fastScroller.onContentChanged()
    dispatchScroll()
  }

  private val surfaceId: Int
    get() = UIManagerHelper.getSurfaceId(this)

  private fun dispatchEvent(event: Event<*>) {
    UIManagerHelper.getEventDispatcher(reactContext)?.dispatchEvent(event)
  }

  protected fun dispatch(name: String, data: WritableMap) {
    if (id == NO_ID) return
    dispatchEvent(ListEvent(surfaceId, id, name, data))
  }

  /** ScrollView-shaped `topScroll`, which Reanimated handles on the UI thread. */
  private fun dispatchScroll() {
    if (!emitsScrollEvents || id == NO_ID) return
    val offset = recyclerView.computeVerticalScrollOffset()
    if (!scrollGate.shouldSend(offset)) return
    dispatchEvent(
      ScrollEvent.obtain(
        surfaceId,
        id,
        ScrollEventType.SCROLL,
        0f,
        offset.toFloat(),
        0f,
        0f,
        recyclerView.width,
        recyclerView.contentHeight,
        recyclerView.width,
        recyclerView.height,
      ),
    )
  }

  private fun toPx(dp: Float) = PixelUtil.toPixelFromDIP(dp).roundToInt()
}
