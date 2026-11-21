package com.margelo.nitro.nitrochapterlist.chapter

import com.margelo.nitro.nitrochapterlist.ChapterRow

/**
 * Position-indexed chapter rows plus selection and downloading state.
 *
 * Main-thread only: [HybridChapterListStore] copies JS input and applies it here
 * on the main thread, so adapters can read without locking. Every mutation
 * reports the smallest set of contiguous ranges to [listeners]. Positions are
 * chapter positions; adapters add their own header offset.
 */
class ChapterListModel {
  interface Listener {
    fun onReset()
    fun onRangeChanged(start: Int, count: Int, payload: Any?)
    fun onRangeInserted(start: Int, count: Int)
  }

  /** Partial-bind payloads, so only the affected parts of a row rebind. */
  object Payload {
    val SELECTION = Any()
    val DOWNLOADING = Any()
  }

  var count: Int = 0
    private set

  /** Bumped on every [reset], so views can drop per-list state like requested batches. */
  var generation: Int = 0
    private set

  private var rows: Array<ChapterRow?> = emptyArray()
  private val positions = HashMap<Int, Int>()
  private var selected = HashSet<Int>()
  private var downloading = HashSet<Int>()
  private val listeners = ArrayList<Listener>()

  fun addListener(listener: Listener) {
    if (!listeners.contains(listener)) listeners.add(listener)
  }

  fun removeListener(listener: Listener) {
    listeners.remove(listener)
  }

  fun rowAt(position: Int): ChapterRow? = rows.getOrNull(position)

  fun positionOf(id: Int): Int = positions[id] ?: -1

  fun isSelected(id: Int): Boolean = selected.contains(id)

  fun isDownloading(id: Int): Boolean = downloading.contains(id)

  fun reset(totalCount: Int) {
    count = totalCount.coerceAtLeast(0)
    rows = arrayOfNulls(count)
    positions.clear()
    generation++
    listeners.forEach { it.onReset() }
  }

  fun setRows(start: Int, newRows: Array<ChapterRow>) {
    if (start < 0 || newRows.isEmpty()) return
    val end = start + newRows.size
    val oldCount = count
    if (end > count) {
      rows = rows.copyOf(end)
      count = end
    }
    for (i in newRows.indices) {
      val position = start + i
      val row = newRows[i]
      val previous = rows[position]
      if (previous != null && positions[previous.id.toInt()] == position) {
        positions.remove(previous.id.toInt())
      }
      rows[position] = row
      positions[row.id.toInt()] = position
    }
    val changedEnd = minOf(end, oldCount)
    if (changedEnd > start) {
      listeners.forEach { it.onRangeChanged(start, changedEnd - start, null) }
    }
    if (count > oldCount) {
      listeners.forEach { it.onRangeInserted(oldCount, count - oldCount) }
    }
  }

  fun updateRows(newRows: Array<ChapterRow>) {
    val changed = IntArray(newRows.size)
    var changedCount = 0
    for (row in newRows) {
      val position = positions[row.id.toInt()] ?: continue
      if (rows[position] != row) {
        rows[position] = row
        changed[changedCount++] = position
      }
    }
    dispatchChanged(changed, changedCount, null)
  }

  fun setSelected(ids: IntArray) {
    selected = applyIdSet(selected, ids, Payload.SELECTION)
  }

  fun setDownloading(ids: IntArray) {
    downloading = applyIdSet(downloading, ids, Payload.DOWNLOADING)
  }

  /** Swaps in the new id set and notifies the positions whose membership changed. */
  private fun applyIdSet(old: HashSet<Int>, ids: IntArray, payload: Any): HashSet<Int> {
    val next = HashSet<Int>(ids.size * 2)
    ids.forEach { next.add(it) }
    val changed = IntArray(old.size + next.size)
    var changedCount = 0
    for (id in old) {
      if (!next.contains(id)) {
        val position = positions[id] ?: continue
        changed[changedCount++] = position
      }
    }
    for (id in next) {
      if (!old.contains(id)) {
        val position = positions[id] ?: continue
        changed[changedCount++] = position
      }
    }
    dispatchChanged(changed, changedCount, payload)
    return next
  }

  private fun dispatchChanged(changed: IntArray, size: Int, payload: Any?) {
    if (size == 0) return
    java.util.Arrays.sort(changed, 0, size)
    var rangeStart = changed[0]
    var previous = rangeStart
    for (i in 1..size) {
      val position = if (i < size) changed[i] else Int.MIN_VALUE
      if (position == previous) continue
      if (position != previous + 1) {
        val start = rangeStart
        val length = previous - rangeStart + 1
        listeners.forEach { it.onRangeChanged(start, length, payload) }
        rangeStart = position
      }
      previous = position
    }
  }
}
