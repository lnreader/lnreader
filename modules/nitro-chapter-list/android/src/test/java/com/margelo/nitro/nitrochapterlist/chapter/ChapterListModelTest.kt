package com.margelo.nitro.nitrochapterlist.chapter

import com.margelo.nitro.nitrochapterlist.ChapterRow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ChapterListModelTest {
  private val model = ChapterListModel()
  private val events = ArrayList<String>()

  private fun row(id: Int, name: String = "Chapter $id", downloaded: Boolean = false) =
    ChapterRow(
      id = id.toDouble(),
      name = name,
      numberText = id.toString(),
      releaseTime = null,
      releaseText = "",
      scanlator = "",
      progress = 0.0,
      unread = true,
      bookmarked = false,
      downloaded = downloaded,
    )

  private fun rows(ids: IntRange) = ids.map { row(it) }.toTypedArray()

  @Before
  fun setUp() {
    model.addListener(
      object : ChapterListModel.Listener {
        override fun onReset() {
          events.add("reset")
        }

        override fun onRangeChanged(start: Int, count: Int, payload: Any?) {
          val tag =
            when (payload) {
              ChapterListModel.Payload.SELECTION -> ":selection"
              ChapterListModel.Payload.DOWNLOADING -> ":downloading"
              ChapterListModel.Payload.HIGHLIGHT -> ":highlight"
              else -> ""
            }
          events.add("changed $start+$count$tag")
        }

        override fun onRangeInserted(start: Int, count: Int) {
          events.add("inserted $start+$count")
        }
      },
    )
  }

  @Test
  fun resetSizesTheListWithPlaceholders() {
    model.reset(2500)

    assertEquals(2500, model.count)
    assertNull(model.rowAt(0))
    assertEquals(listOf("reset"), events)
  }

  @Test
  fun setRowsFillsPositionsAndNotifiesOneRange() {
    model.reset(2500)
    events.clear()

    model.setRows(1000, rows(1..1000))

    assertEquals(1, model.rowAt(1000)?.id?.toInt())
    assertEquals(1999, model.positionOf(1000))
    assertEquals(listOf("changed 1000+1000"), events)
  }

  @Test
  fun setRowsPastTheEndGrowsTheList() {
    model.reset(2)
    events.clear()

    model.setRows(1, rows(10..12))

    assertEquals(4, model.count)
    assertEquals(listOf("changed 1+1", "inserted 2+2"), events)
  }

  @Test
  fun setRowsDropsTheIdOfAReplacedRow() {
    model.reset(1)
    model.setRows(0, arrayOf(row(5)))

    model.setRows(0, arrayOf(row(6)))

    assertEquals(-1, model.positionOf(5))
    assertEquals(0, model.positionOf(6))
  }

  @Test
  fun updateRowsPatchesByIdAndCoalescesRanges() {
    model.reset(10)
    model.setRows(0, rows(1..10))
    events.clear()

    model.updateRows(
      arrayOf(row(4, "read"), row(3, "read"), row(9, "read"), row(42, "unknown"), row(1)),
    )

    assertEquals("read", model.rowAt(2)?.name)
    // Row 1 is unchanged and id 42 isn't in the list.
    assertEquals(listOf("changed 2+2", "changed 8+1"), events)
  }

  @Test
  fun selectionNotifiesOnlyRowsWhoseStateChanged() {
    model.reset(10)
    model.setRows(0, rows(1..10))
    model.setSelected(intArrayOf(1, 2, 3))
    events.clear()

    model.setSelected(intArrayOf(2, 3, 4, 5))

    assertFalse(model.isSelected(1))
    assertTrue(model.isSelected(5))
    assertEquals(listOf("changed 0+1:selection", "changed 3+2:selection"), events)
  }

  @Test
  fun downloadingUsesItsOwnPayload() {
    model.reset(3)
    model.setRows(0, rows(1..3))
    events.clear()

    model.setDownloading(intArrayOf(2))
    model.setDownloading(intArrayOf())

    assertFalse(model.isDownloading(2))
    assertEquals(listOf("changed 1+1:downloading", "changed 1+1:downloading"), events)
  }

  @Test
  fun selectionOfUnloadedIdsIsKeptForWhenTheyLoad() {
    model.reset(3)
    model.setSelected(intArrayOf(7))
    events.clear()

    model.setRows(0, arrayOf(row(7)))

    assertTrue(model.isSelected(7))
    assertEquals(listOf("changed 0+1"), events)
  }

  @Test
  fun longPressExtendsSelectionAndTapTogglesAChapter() {
    model.setRows(0, arrayOf(row(5), row(3), row(20), row(2), row(4)))

    model.extendSelection(5)
    model.extendSelection(2)
    assertEquals(listOf(5, 3, 2, 4), model.selectionIds().toList())

    model.toggleSelection(3)
    assertEquals(listOf(5, 2, 4), model.selectionIds().toList())
    assertFalse(model.isSelected(20))
  }

  @Test
  fun selectAllIncludesUnloadedRowsAndIgnoresAnOlderRequest() {
    model.setRows(0, arrayOf(row(1), row(2)))
    model.toggleSelection(1)
    val old = model.requestSelectAll()
    val next = model.requestSelectAll()

    model.completeSelectAll(old, intArrayOf(7))
    assertEquals(listOf(1), model.selectionIds().toList())

    model.completeSelectAll(next, intArrayOf(1, 2, 3))
    assertEquals(3, model.selectionCount)
    assertTrue(model.isSelected(3))
    assertTrue(model.selectionSummary().hasDownloaded)
  }

  @Test
  fun selectionEditsAndPageChangesInvalidatePendingSelectAll() {
    model.setSelectionScope("page-one")
    model.setRows(0, rows(1..3))
    model.toggleSelection(1)
    val beforeEdit = model.requestSelectAll()
    model.toggleSelection(2)
    model.completeSelectAll(beforeEdit, intArrayOf(1, 2, 3))
    assertEquals(listOf(1, 2), model.selectionIds().toList())

    val beforePage = model.requestSelectAll()
    model.setSelectionScope("page-two")
    model.completeSelectAll(beforePage, intArrayOf(1, 2, 3))
    assertEquals(0, model.selectionCount)
  }

  @Test
  fun highlightRebindsOnlyThePreviousAndNewRows() {
    model.reset(100)
    model.setRows(0, rows(1..100))
    events.clear()

    model.setHighlighted(10)
    model.setHighlighted(50)
    model.setHighlighted(50)
    model.setHighlighted(null)

    assertEquals(
      listOf("changed 9+1:highlight", "changed 9+1:highlight", "changed 49+1:highlight", "changed 49+1:highlight"),
      events,
    )
    assertEquals(-1, model.highlightedPosition)
  }

  @Test
  fun highlightOfAnUnloadedChapterIsKeptForWhenItLoads() {
    model.reset(2000)
    events.clear()

    model.setHighlighted(1500)
    assertTrue(events.isEmpty())
    assertEquals(-1, model.highlightedPosition)

    model.setRows(1000, rows(1001..2000))
    assertEquals(1499, model.highlightedPosition)
    assertTrue(model.isHighlighted(1500))
  }

  @Test
  fun resetBumpsTheGeneration() {
    val before = model.generation
    model.reset(1)
    assertEquals(before + 1, model.generation)
  }
}
