package com.margelo.nitro.nitrochapterlist.core

/**
 * Turns "a placeholder row was bound" into at most one request per batch of
 * [batchSize] rows, until the list is replaced ([generation] changes).
 */
class RangeRequester {
  var batchSize: Int = 1000
    set(value) {
      field = value.coerceAtLeast(1)
      requested.clear()
    }

  private val requested = HashSet<Int>()
  private var generation = Int.MIN_VALUE

  /** The `[start, end]` positions to request, or null if already requested. */
  fun onPlaceholderBound(position: Int, count: Int, generation: Int): IntRange? {
    if (generation != this.generation) {
      this.generation = generation
      requested.clear()
    }
    val batch = position / batchSize
    if (!requested.add(batch)) return null
    val start = batch * batchSize
    return start..(minOf(count, start + batchSize) - 1)
  }
}
