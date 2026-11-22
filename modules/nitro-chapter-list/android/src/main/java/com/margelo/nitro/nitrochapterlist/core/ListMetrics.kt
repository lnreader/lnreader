package com.margelo.nitro.nitrochapterlist.core

import kotlin.math.roundToInt

/**
 * Exact scroll maths for "optional header + fixed-height rows". Pure, so it's
 * unit tested without a RecyclerView.
 *
 * Adapter positions below [headerCount] are the header (0 or 1 item); rows
 * follow. Row `i` starts [rowTop] px below the header: `i * rowHeight`, or
 * [rowOffsets] when rows have different heights.
 */
class ListMetrics(var rowHeight: Int, private val headerHeightSource: () -> Int) {
  /** 1 when the list shows its React header item, 0 when headerless. */
  var headerCount: Int = 1
    set(value) {
      field = value.coerceIn(0, 1)
    }

  /** Optional cumulative heights for lists with shorter section and loading rows. */
  var rowOffsets: IntArray? = null

  /** The header's height, or 0 without one (the header container keeps its last height). */
  val headerHeight: Int
    get() = if (headerCount == 0) 0 else headerHeightSource()

  fun rowTop(index: Int): Int = rowOffsets?.getOrNull(index) ?: (index * rowHeight)

  fun rowCount(itemCount: Int): Int = (itemCount - headerCount).coerceAtLeast(0)

  fun contentHeight(itemCount: Int, paddingTop: Int, paddingBottom: Int): Int =
    paddingTop + headerHeight + rowTop(rowCount(itemCount)) + paddingBottom

  /** Top of the item at [adapterPosition], from the top of the content (excluding padding). */
  fun itemStart(adapterPosition: Int): Int =
    if (adapterPosition < headerCount) 0 else headerHeight + rowTop(adapterPosition - headerCount)

  /** Scroll offset of a list whose first child is [adapterPosition], its top at [childTop] px. */
  fun scrollOffset(adapterPosition: Int, childTop: Int, paddingTop: Int): Int =
    paddingTop + itemStart(adapterPosition) - childTop

  /**
   * Where `scrollToPositionWithOffset` must go to sit at [offset] px:
   * `[adapterPosition, offsetWithinItem]`, where the item's top ends up
   * `offsetWithinItem` px above the viewport's top.
   */
  fun jumpTarget(offset: Int, itemCount: Int): IntArray {
    val rows = rowCount(itemCount)
    val header = headerHeight
    if (rows == 0 || (headerCount > 0 && offset < header)) return intArrayOf(0, offset.coerceAtLeast(0))
    val intoRows = (offset - header).coerceAtLeast(0)
    val index =
      (rowOffsets?.binarySearch(intoRows)?.let { result -> if (result >= 0) result else -result - 2 }
        ?: (intoRows / rowHeight.coerceAtLeast(1))).coerceIn(0, rows - 1)
    return intArrayOf(index + headerCount, intoRows - rowTop(index))
  }

  /** Offset that puts row [index] at [viewPosition] (0 top, 1 bottom) of a [viewport] px tall list. */
  fun offsetForIndex(index: Int, viewPosition: Float, paddingTop: Int, viewport: Int, paddingBottom: Int): Int {
    val itemTop = paddingTop + headerHeight + rowTop(index)
    val itemHeight = rowTop(index + 1) - rowTop(index)
    return (itemTop - viewPosition * (viewport - paddingBottom - itemHeight)).roundToInt()
  }

  /** Row index of [adapterPosition], or -1 for the header and RecyclerView's NO_POSITION. */
  fun rowIndex(adapterPosition: Int): Int = if (adapterPosition < headerCount) -1 else adapterPosition - headerCount
}
