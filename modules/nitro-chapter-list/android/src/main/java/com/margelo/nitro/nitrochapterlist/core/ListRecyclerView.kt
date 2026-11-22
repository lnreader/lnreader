package com.margelo.nitro.nitrochapterlist.core

import android.annotation.SuppressLint
import android.content.Context
import android.view.MotionEvent
import android.view.View
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.uimanager.events.NativeGestureUtil
import kotlin.math.abs

/**
 * RecyclerView with exact scroll metrics for "optional header + fixed-height
 * rows": with a header, adapter position 0 is [header]; every other item is
 * [rowHeight] px tall. See [ListMetrics].
 *
 * LinearLayoutManager estimates offset and range from the average height of the
 * visible children, which a tall header skews. Rows are all [rowHeight] tall,
 * so the exact values are cheap to compute; the fast scroller, the RN scroll
 * event and [scrollToOffset] all use them.
 */
@SuppressLint("ViewConstructor")
class ListRecyclerView(
  context: Context,
  private val header: HeaderContainer,
  rowHeight: Int,
) : RecyclerView(context) {
  val linearLayoutManager = LinearLayoutManager(context)
  val metrics = ListMetrics(rowHeight) { header.contentHeight }

  var rowHeight: Int
    get() = metrics.rowHeight
    set(value) {
      metrics.rowHeight = value
    }

  // Optional cumulative heights for lists with shorter section and loading rows.
  var rowOffsets: IntArray?
    get() = metrics.rowOffsets
    set(value) {
      metrics.rowOffsets = value
    }

  /** 1 with the header item at position 0, 0 when headerless (rows start at 0). */
  val headerCount: Int
    get() = metrics.headerCount

  private var nativeGestureStarted = false
  private var pendingSmoothScroll: Runnable? = null

  init {
    layoutManager = linearLayoutManager
    setHasFixedSize(true)
    itemAnimator = null
    clipToPadding = false
    isVerticalScrollBarEnabled = false
    overScrollMode = OVER_SCROLL_ALWAYS
  }

  private val itemCount: Int
    get() = adapter?.itemCount ?: 0

  val contentHeight: Int
    get() = metrics.contentHeight(itemCount, paddingTop, paddingBottom)

  val maxScrollOffset: Int
    get() = (contentHeight - height).coerceAtLeast(0)

  override fun computeVerticalScrollRange(): Int = contentHeight

  override fun computeVerticalScrollExtent(): Int = height

  override fun computeVerticalScrollOffset(): Int {
    val first = getChildAt(0) ?: return 0
    val position = getChildLayoutPosition(first)
    if (position == NO_POSITION) return 0
    return metrics.scrollOffset(position, linearLayoutManager.getDecoratedTop(first), paddingTop)
  }

  /** First and last (partly) visible row indices, or -1 when none (the header doesn't count). */
  fun firstVisibleRow(): Int = metrics.rowIndex(linearLayoutManager.findFirstVisibleItemPosition())

  fun lastVisibleRow(): Int = metrics.rowIndex(linearLayoutManager.findLastVisibleItemPosition())

  /** Puts the list at [offset] px immediately, without laying out what's in between. */
  fun jumpToOffset(offset: Int) {
    val (position, within) = metrics.jumpTarget(offset.coerceIn(0, maxScrollOffset), itemCount)
    linearLayoutManager.scrollToPositionWithOffset(position, -within)
  }

  /** Before the first layout: opens the list with row [index] at the top. */
  fun scrollToRowBeforeLayout(index: Int) {
    linearLayoutManager.scrollToPositionWithOffset(index + headerCount, 0)
  }

  /**
   * Scrolls to [offset] px. Long animated scrolls first jump to within two
   * screens of the target: smooth-scrolling through thousands of rows would bind
   * every one of them.
   */
  fun scrollToOffset(offset: Int, animated: Boolean) {
    pendingSmoothScroll?.let { removeCallbacks(it) }
    pendingSmoothScroll = null
    stopScroll()
    val target = offset.coerceIn(0, maxScrollOffset)
    if (!animated) {
      jumpToOffset(target)
      return
    }
    val distance = target - computeVerticalScrollOffset()
    val limit = height * 2
    if (abs(distance) <= limit) {
      smoothScrollBy(0, distance)
      return
    }
    jumpToOffset(if (distance > 0) target - limit else target + limit)
    val smooth = Runnable {
      pendingSmoothScroll = null
      smoothScrollBy(0, target.coerceIn(0, maxScrollOffset) - computeVerticalScrollOffset())
    }
    pendingSmoothScroll = smooth
    // After the jump's layout pass.
    post(smooth)
  }

  /** Offset that puts row [index] at [viewPosition] (0 top, 1 bottom) of the viewport. */
  fun offsetForIndex(index: Int, viewPosition: Float): Int =
    metrics.offsetForIndex(index, viewPosition, paddingTop, height, paddingBottom)

  /**
   * react-native-screens calls startViewTransition on every view of a screen
   * being popped, so Fabric's removals stay visible during the exit animation.
   * A child in a view transition keeps its parent when detached, and when
   * RecyclerView then recycles one of its own item views it throws "Scrapped
   * or attached views may not be recycled". Item views are never removed by
   * Fabric, so they don't need the transition: ignore it.
   */
  override fun startViewTransition(view: View) {}

  override fun onInterceptTouchEvent(e: MotionEvent): Boolean {
    if (super.onInterceptTouchEvent(e)) {
      notifyGestureStarted(e)
      return true
    }
    return false
  }

  override fun onTouchEvent(e: MotionEvent): Boolean {
    val handled = super.onTouchEvent(e)
    if (scrollState == SCROLL_STATE_DRAGGING) notifyGestureStarted(e)
    if (nativeGestureStarted &&
      (e.actionMasked == MotionEvent.ACTION_UP || e.actionMasked == MotionEvent.ACTION_CANCEL)
    ) {
      NativeGestureUtil.notifyNativeGestureEnded(this, e)
      nativeGestureStarted = false
    }
    return handled
  }

  /** Cancels any JS touch in progress (e.g. a press on the header) once the list takes over. */
  private fun notifyGestureStarted(e: MotionEvent) {
    if (nativeGestureStarted) return
    NativeGestureUtil.notifyNativeGestureStarted(this, e)
    nativeGestureStarted = true
  }

}
