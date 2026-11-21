package com.margelo.nitro.nitrochapterlist.core

/**
 * Decides which scroll offsets are worth an event. JS listens on the UI thread
 * (Reanimated), but every event still reaches the JS thread, so offsets JS
 * doesn't care about are dropped:
 *
 * - every change while the offset is at most [continuousUntil] (and the first
 *   one past it, so JS sees the range end);
 * - any offset that crosses one of [thresholds] (`last > t` != `offset > t`);
 * - nothing else.
 *
 * Values are in px. A negative [continuousUntil] sends every change.
 */
class ScrollEventGate {
  var continuousUntil: Float = -1f
  var thresholds: FloatArray = FloatArray(0)

  private var hasSent = false
  private var lastSent = 0

  fun shouldSend(offset: Int, force: Boolean = false): Boolean {
    if (!hasSent || force || continuousUntil < 0f) return record(offset)
    val last = lastSent
    if (offset == last) return false
    if (offset <= continuousUntil || last <= continuousUntil) return record(offset)
    for (threshold in thresholds) {
      if ((last > threshold) != (offset > threshold)) return record(offset)
    }
    return false
  }

  /** Forget the last offset, so the next one is always sent. */
  fun reset() {
    hasSent = false
  }

  private fun record(offset: Int): Boolean {
    hasSent = true
    lastSent = offset
    return true
  }
}
