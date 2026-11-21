package com.margelo.nitro.nitrochapterlist.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RangeRequesterTest {
  @Test
  fun requestsEachBatchOncePerGeneration() {
    val requester = RangeRequester()

    assertEquals(1000..1999, requester.onPlaceholderBound(1500, 2500, generation = 1))
    assertNull(requester.onPlaceholderBound(1999, 2500, generation = 1))
    assertEquals(2000..2499, requester.onPlaceholderBound(2400, 2500, generation = 1))
  }

  @Test
  fun requestsAgainAfterTheListIsReplaced() {
    val requester = RangeRequester()
    requester.onPlaceholderBound(10, 100, generation = 1)

    assertEquals(0..99, requester.onPlaceholderBound(10, 100, generation = 2))
  }

  @Test
  fun usesTheConfiguredBatchSize() {
    val requester = RangeRequester().apply { batchSize = 50 }

    assertEquals(50..99, requester.onPlaceholderBound(75, 1000, generation = 0))
  }
}
