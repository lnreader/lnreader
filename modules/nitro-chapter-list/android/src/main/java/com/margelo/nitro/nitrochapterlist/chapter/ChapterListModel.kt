package com.margelo.nitro.nitrochapterlist.chapter

import com.margelo.nitro.nitrochapterlist.ChapterRow

/**
 * Position-indexed chapter rows plus selection, downloading and highlighted state.
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
    fun onSelectionChanged() {}
  }

  /** Partial-bind payloads, so only the affected parts of a row rebind. */
  object Payload {
    val SELECTION = Any()
    val DOWNLOADING = Any()
    val HIGHLIGHT = Any()
  }

  var count: Int = 0
    private set

  /** Bumped on every [reset], so views can drop per-list state like requested batches. */
  var generation: Int = 0
    private set

  private var rows: Array<ChapterRow?> = emptyArray()
  private val positions = HashMap<Int, Int>()
  private var selected = LinkedHashSet<Int>()
  private var selectionKey: String? = null
  private var requestSequence = 0
  private var pendingSelectAll: Int? = null
  private var downloading = HashSet<Int>()

  /** The highlighted chapter (the reader's current chapter), or null. */
  var highlightedId: Int? = null
    private set
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

  val selectionCount: Int get() = selected.size

  fun selectionIds(): IntArray = selected.toIntArray()

  fun setSelectionScope(key: String) {
    if (selectionKey == key) return
    selectionKey = key
    clearSelection()
  }

  fun clearSelection() = setSelected(IntArray(0))

  fun toggleSelection(id: Int) {
    if (positions[id] == null) return
    pendingSelectAll = null
    if (!selected.remove(id)) selected.add(id)
    listeners.forEach { it.onRangeChanged(positions.getValue(id), 1, Payload.SELECTION) }
    listeners.forEach { it.onSelectionChanged() }
  }

  fun extendSelection(id: Int) {
    if (positions[id] == null) return
    val anchor = selected.lastOrNull()
    if (anchor == null) {
      toggleSelection(id)
      return
    }
    pendingSelectAll = null
    if (id == anchor) return
    // Match the existing long-press rule: include loaded IDs between the two presses.
    val bounds = minOf(id, anchor)..maxOf(id, anchor)
    val changed = IntArray(positions.size)
    var size = 0
    for ((position, row) in rows.withIndex()) {
      val rowId = row?.id?.toInt() ?: continue
      if (rowId in bounds && selected.add(rowId)) changed[size++] = position
    }
    if (size == 0) return
    dispatchChanged(changed, size, Payload.SELECTION)
    listeners.forEach { it.onSelectionChanged() }
  }

  fun requestSelectAll(): Int = (++requestSequence).also { pendingSelectAll = it }

  fun completeSelectAll(request: Int, ids: IntArray) {
    if (pendingSelectAll == request) setSelected(ids)
  }

  fun selectionSummary(): ChapterSelectionSummary {
    var loadedCount = 0
    var onlyLoaded: ChapterRow? = null
    var downloaded = false
    var undownloaded = false
    var unread = false
    var read = false
    for (id in selected) {
      val row = positions[id]?.let { rows[it] } ?: continue
      loadedCount++
      onlyLoaded = row
      if (row.downloaded) downloaded = true else undownloaded = true
      if (row.unread) unread = true else read = true
    }
    val hasUnloaded = loadedCount < selected.size
    return ChapterSelectionSummary(
      selected.size,
      downloaded || hasUnloaded,
      undownloaded || hasUnloaded,
      unread || hasUnloaded,
      read || hasUnloaded,
      onlyLoaded?.takeIf { loadedCount == 1 },
    )
  }

  fun isDownloading(id: Int): Boolean = downloading.contains(id)

  fun isHighlighted(id: Int): Boolean = highlightedId == id

  /** Position of the highlighted chapter, or -1 when none or not loaded. */
  val highlightedPosition: Int
    get() = highlightedId?.let { positionOf(it) } ?: -1

  /** Only the previous and the new highlighted rows rebind ([Payload.HIGHLIGHT]). */
  fun setHighlighted(id: Int?) {
    if (id == highlightedId) return
    val previous = highlightedPosition
    highlightedId = id
    val next = highlightedPosition
    val changed = IntArray(2)
    var changedCount = 0
    if (previous >= 0) changed[changedCount++] = previous
    if (next >= 0) changed[changedCount++] = next
    dispatchChanged(changed, changedCount, Payload.HIGHLIGHT)
  }

  fun reset(totalCount: Int) {
    pendingSelectAll = null
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
    pendingSelectAll = null
    val previous = selected
    val next = ids.toCollection(LinkedHashSet())
    selected = next
    if (previous == next) return
    dispatchIdSetChanges(previous, next, Payload.SELECTION)
    listeners.forEach { it.onSelectionChanged() }
  }

  fun setDownloading(ids: IntArray) {
    val previous = downloading
    downloading = ids.toHashSet()
    dispatchIdSetChanges(previous, downloading, Payload.DOWNLOADING)
  }

  /** Swaps in the new id set and notifies the positions whose membership changed. */
  private fun dispatchIdSetChanges(old: Set<Int>, next: Set<Int>, payload: Any) {
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
