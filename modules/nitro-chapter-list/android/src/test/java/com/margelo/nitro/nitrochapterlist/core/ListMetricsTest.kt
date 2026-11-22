package com.margelo.nitro.nitrochapterlist.core

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class ListMetricsTest {
  private val rowHeight = 62

  private fun metrics(headerHeight: Int, headerCount: Int) =
    ListMetrics(rowHeight) { headerHeight }.apply { this.headerCount = headerCount }

  @Test
  fun headerlessRowsStartAtPositionZero() {
    val metrics = metrics(headerHeight = 500, headerCount = 0)

    // The header container may keep a height; without a header it never counts.
    assertEquals(0, metrics.headerHeight)
    assertEquals(100, metrics.rowCount(itemCount = 100))
    assertEquals(0, metrics.itemStart(0))
    assertEquals(3 * rowHeight, metrics.itemStart(3))
    assertEquals(0, metrics.rowIndex(0))
    assertEquals(-1, metrics.rowIndex(-1))
  }

  @Test
  fun headerlessContentHeightAndOffsetAreExact() {
    val metrics = metrics(headerHeight = 500, headerCount = 0)

    assertEquals(12 + 100 * rowHeight + 8, metrics.contentHeight(itemCount = 100, paddingTop = 12, paddingBottom = 8))
    // Row 3 is first, scrolled 20px out of view.
    assertEquals(12 + 3 * rowHeight + 20, metrics.scrollOffset(3, childTop = -20, paddingTop = 12))
  }

  @Test
  fun headerlessJumpTargetsLandOnTheRightRow() {
    val metrics = metrics(headerHeight = 500, headerCount = 0)

    assertArrayEquals(intArrayOf(0, 0), metrics.jumpTarget(0, itemCount = 100))
    assertArrayEquals(intArrayOf(10, 5), metrics.jumpTarget(10 * rowHeight + 5, itemCount = 100))
    assertArrayEquals(intArrayOf(99, rowHeight * 2), metrics.jumpTarget(101 * rowHeight, itemCount = 100))
  }

  @Test
  fun headerlessOffsetForIndexIgnoresTheHeader() {
    val metrics = metrics(headerHeight = 500, headerCount = 0)

    assertEquals(12 + 40 * rowHeight, metrics.offsetForIndex(40, 0f, paddingTop = 12, viewport = 600, paddingBottom = 8))
    // At the bottom of the viewport: above it by viewport - padding - row.
    assertEquals(
      12 + 40 * rowHeight - (600 - 8 - rowHeight),
      metrics.offsetForIndex(40, 1f, paddingTop = 12, viewport = 600, paddingBottom = 8),
    )
  }

  @Test
  fun withAHeaderRowsFollowIt() {
    val metrics = metrics(headerHeight = 500, headerCount = 1)

    assertEquals(99, metrics.rowCount(itemCount = 100))
    assertEquals(0, metrics.itemStart(0))
    assertEquals(500 + 2 * rowHeight, metrics.itemStart(3))
    assertEquals(-1, metrics.rowIndex(0))
    assertEquals(2, metrics.rowIndex(3))
    assertEquals(500 + 99 * rowHeight, metrics.contentHeight(itemCount = 100, paddingTop = 0, paddingBottom = 0))
    // Inside the header, the header item is the target.
    assertArrayEquals(intArrayOf(0, 120), metrics.jumpTarget(120, itemCount = 100))
    assertArrayEquals(intArrayOf(11, 5), metrics.jumpTarget(500 + 10 * rowHeight + 5, itemCount = 100))
  }

  @Test
  fun rowOffsetsReplaceFixedHeights() {
    val metrics = metrics(headerHeight = 0, headerCount = 1).apply { rowOffsets = intArrayOf(0, 32, 96, 160) }

    assertEquals(96, metrics.itemStart(3))
    assertArrayEquals(intArrayOf(2, 10), metrics.jumpTarget(42, itemCount = 4))
  }
}
