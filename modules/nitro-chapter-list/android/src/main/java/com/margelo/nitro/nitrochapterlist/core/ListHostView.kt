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
 * Subclasses supply the adapter (header at [ListRecyclerView.HEADER_COUNT] - 1,
 * rows of [rowHeight] px after it) and their own row events.
 */
@SuppressLint("ViewConstructor")
abstract class ListHostView(
  protected val reactContext: ThemedReactContext,
  rowHeight: Int,
) : FrameLayout(reactContext) {
  val header = HeaderContainer(reactContext)
  protected val recyclerView = ListRecyclerView(reactContext, header, rowHeight)
  private val swipeRefresh = ReactSwipeRefreshLayout(reactContext)
  private val fastScroller = ListFastScroller(recyclerView)
  private val scrollGate = ScrollEventGate()
  private val rangeRequester = RangeRequester()

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
        override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
          dispatchScroll()
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

  // --- Props ---

  protected fun setListColors(
    thumb: Int,
    pressedThumb: Int,
    track: Int,
    refreshIndicator: Int,
    refreshBackground: Int,
  ) {
    fastScroller.setColors(thumb, pressedThumb, track)
    swipeRefresh.setColorSchemeColors(refreshIndicator)
    swipeRefresh.setProgressBackgroundColorSchemeColor(refreshBackground)
  }

  fun setRefreshing(value: Boolean) {
    swipeRefresh.isRefreshing = value
  }

  fun setRefreshOffset(dp: Float) {
    swipeRefresh.setProgressViewOffset(dp)
  }

  fun setContentPaddingBottom(dp: Float) {
    val px = toPx(dp)
    if (recyclerView.paddingBottom == px) return
    recyclerView.setPadding(0, 0, 0, px)
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
    dispatchEvent(ListEvent(surfaceId, id, name, data))
  }

  /** ScrollView-shaped `topScroll`, which Reanimated handles on the UI thread. */
  private fun dispatchScroll() {
    if (id == NO_ID) return
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
