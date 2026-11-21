package com.margelo.nitro.nitrochapterlist.core

import org.junit.Assert.assertEquals
import org.junit.Test

class ScrollEventGateTest {
  private fun gate(until: Float, vararg thresholds: Float) =
    ScrollEventGate().apply {
      continuousUntil = until
      this.thresholds = thresholds
    }

  private fun ScrollEventGate.sent(vararg offsets: Int) = offsets.filter { shouldSend(it) }

  @Test
  fun sendsEveryChangeWhenUnbounded() {
    assertEquals(listOf(0, 5000, 9000), gate(-1f).sent(0, 5000, 9000))
  }

  @Test
  fun sendsEveryChangeInsideTheRangeAndTheFirstOneOutside() {
    assertEquals(listOf(0, 100, 200, 260), gate(200f).sent(0, 100, 200, 260, 300, 5000))
  }

  @Test
  fun sendsThresholdCrossingsInBothDirectionsPastTheRange() {
    val gate = gate(200f, 1000f)
    assertEquals(listOf(0, 300, 1001, 990), gate.sent(0, 300, 600, 1001, 4000, 1200, 990, 800))
  }

  @Test
  fun sendsAJumpBackIntoTheRange() {
    assertEquals(listOf(0, 300, 0), gate(200f).sent(0, 300, 90000, 0))
  }

  @Test
  fun skipsRepeatsAndSendsAgainAfterReset() {
    val gate = gate(200f)
    assertEquals(listOf(50), gate.sent(50, 50))
    gate.reset()
    assertEquals(listOf(50), gate.sent(50))
  }
}
