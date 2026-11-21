package com.margelo.nitro.nitrochapterlist.core

import android.os.SystemClock

/**
 * Turns "a placeholder row was bound" into one request per batch of
 * [batchSize] rows. A batch can be asked for again once [retryAfterMs] has
 * passed: loaded rows stop binding as placeholders, so this only happens when
 * a load failed or is stuck, and binding the placeholder again (scrolling back
 * to it) retries. Everything resets when the list is replaced ([generation]).
 */
class RangeRequester(private val clock: () -> Long = SystemClock::uptimeMillis) {
  var batchSize: Int = 1000
    set(value) {
      field = value.coerceAtLeast(1)
      requestedAt.clear()
    }

  private val requestedAt = HashMap<Int, Long>()
  private var generation = Int.MIN_VALUE

  /** The `[start, end]` positions to request, or null if recently requested. */
  fun onPlaceholderBound(position: Int, count: Int, generation: Int): IntRange? {
    if (generation != this.generation) {
      this.generation = generation
      requestedAt.clear()
    }
    val batch = position / batchSize
    val now = clock()
    val last = requestedAt[batch]
    if (last != null && now - last < RETRY_AFTER_MS) return null
    requestedAt[batch] = now
    val start = batch * batchSize
    return start..(minOf(count, start + batchSize) - 1)
  }

  companion object {
    const val RETRY_AFTER_MS = 3000L
  }
}
