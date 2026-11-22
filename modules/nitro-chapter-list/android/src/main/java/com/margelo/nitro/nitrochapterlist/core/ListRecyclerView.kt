package com.margelo.nitro.nitrochapterlist.core

import android.annotation.SuppressLint
import android.content.Context
import android.view.MotionEvent
import android.view.View
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.uimanager.events.NativeGestureUtil
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * RecyclerView with exact scroll metrics for "header + fixed-height rows":
 * adapter position 0 is [header], every other item is [rowHeight] px tall.
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
  val rowHeight: Int,
) : RecyclerView(context) {
  val linearLayoutManager = LinearLayoutManager(context)
  // Optional cumulative heights for lists with shorter section and loading rows.
  var rowOffsets: IntArray? = null
  private fun rowTop(index: Int): Int = rowOffsets?.getOrNull(index) ?: index * rowHeight

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

  private val rowCount: Int
    get() = ((adapter?.itemCount ?: 0) - HEADER_COUNT).coerceAtLeast(0)

  val contentHeight: Int
    get() = paddingTop + header.contentHeight + rowTop(rowCount) + paddingBottom

  val maxScrollOffset: Int
    get() = (contentHeight - height).coerceAtLeast(0)

  override fun computeVerticalScrollRange(): Int = contentHeight

  override fun computeVerticalScrollExtent(): Int = height

  override fun computeVerticalScrollOffset(): Int {
    val first = getChildAt(0) ?: return 0
    val position = getChildLayoutPosition(first)
    if (position == NO_POSITION) return 0
    val top = linearLayoutManager.getDecoratedTop(first)
    val itemStart =
      if (position == 0) 0 else header.contentHeight + rowTop(position - HEADER_COUNT)
    return paddingTop + itemStart - top
  }

  /** Puts the list at [offset] px immediately, without laying out what's in between. */
  fun jumpToOffset(offset: Int) {
    val target = offset.coerceIn(0, maxScrollOffset)
    val headerHeight = header.contentHeight
    if (target < headerHeight || rowCount == 0) {
      linearLayoutManager.scrollToPositionWithOffset(0, -target)
      return
    }
    val intoRows = target - headerHeight
    val index = (rowOffsets?.binarySearch(intoRows)?.let { result ->
      if (result >= 0) result else -result - 2
    } ?: (intoRows / rowHeight)).coerceIn(0, rowCount - 1)
    linearLayoutManager.scrollToPositionWithOffset(
      index + HEADER_COUNT,
      -(intoRows - rowTop(index)),
    )
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
  fun offsetForIndex(index: Int, viewPosition: Float): Int {
    val itemTop = paddingTop + header.contentHeight + rowTop(index)
    val itemHeight = rowTop(index + 1) - rowTop(index)
    return (itemTop - viewPosition * (height - paddingBottom - itemHeight)).roundToInt()
  }

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

  companion object {
    /** Adapters put the header at position 0; rows start here. */
    const val HEADER_COUNT = 1
  }
}
