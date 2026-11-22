package com.margelo.nitro.nitrochapterlist.core

import com.margelo.nitro.nitrochapterlist.core.HighlightVisibility.State
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HighlightVisibilityTest {
  @Test
  fun comparesTheHighlightedRowWithTheVisibleRange() {
    assertEquals(State.ABOVE, HighlightVisibility.compute(first = 10, last = 20, highlighted = 9))
    assertEquals(State.VISIBLE, HighlightVisibility.compute(first = 10, last = 20, highlighted = 10))
    assertEquals(State.VISIBLE, HighlightVisibility.compute(first = 10, last = 20, highlighted = 20))
    assertEquals(State.BELOW, HighlightVisibility.compute(first = 10, last = 20, highlighted = 21))
  }

  @Test
  fun unknownPositionsGiveNoState() {
    assertNull(HighlightVisibility.compute(first = -1, last = -1, highlighted = 5))
    assertNull(HighlightVisibility.compute(first = 0, last = 10, highlighted = -1))
  }

  @Test
  fun reportsOnlyChanges() {
    val visibility = HighlightVisibility()

    assertEquals(State.VISIBLE, visibility.update(0, 10, 5))
    assertNull(visibility.update(1, 11, 5))
    assertEquals(State.ABOVE, visibility.update(6, 16, 5))
    assertNull(visibility.update(30, 40, 5))
    // An unknown position keeps the last state rather than reporting one.
    assertNull(visibility.update(30, 40, -1))
    assertEquals(State.BELOW, visibility.update(0, 4, 5))
  }

  @Test
  fun reportsAgainAfterReset() {
    val visibility = HighlightVisibility()
    visibility.update(0, 10, 5)

    visibility.reset()

    assertEquals(State.VISIBLE, visibility.update(0, 10, 5))
  }
}
