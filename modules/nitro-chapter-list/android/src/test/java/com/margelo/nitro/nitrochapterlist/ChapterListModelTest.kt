package com.margelo.nitro.nitrochapterlist

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ChapterListModelTest {
  private val model = ChapterListModel()
  private val events = ArrayList<String>()

  private fun row(id: Int, title: String = "Chapter $id", downloaded: Boolean = false) =
    ChapterRow(id.toDouble(), title, "", unread = true, bookmarked = false, downloaded = downloaded)

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

    assertEquals("read", model.rowAt(2)?.title)
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
  fun resetBumpsTheGeneration() {
    val before = model.generation
    model.reset(1)
    assertEquals(before + 1, model.generation)
  }
}
