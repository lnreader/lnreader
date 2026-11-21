package com.margelo.nitro.nitrochapterlist.chapter

import android.os.SystemClock
import android.util.Log

/**
 * Timing logs for profiling on a device: `adb logcat -s LNChapterList`.
 * One line per data change, never per frame.
 */
internal object ChapterListPerf {
  private const val TAG = "LNChapterList"

  fun now(): Long = SystemClock.elapsedRealtimeNanos()

  fun log(what: String, startNanos: Long) {
    Log.d(TAG, "$what: ${"%.2f".format((now() - startNanos) / 1_000_000.0)} ms")
  }
}
