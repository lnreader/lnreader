package com.margelo.nitro.nitrochapterlist.chapter

import com.margelo.nitro.nitrochapterlist.ChapterRow
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Native row text must match what `ChapterItem` renders in JS. The fixture's
 * expectations are checked against the JS formatting by
 * chapterRowFormatParity.test.ts; this checks ChapterRowFormatter against the
 * same file. The locale's short date ('default' outside the relative range) is
 * ICU on the device and isn't covered here.
 */
class ChapterRowFormatterParityTest {
  private val originalZone = TimeZone.getDefault()

  @After
  fun restoreZone() {
    TimeZone.setDefault(originalZone)
  }

  private val fixture: JSONObject by lazy {
    val file =
      listOf("../fixtures/chapter-row-format.json", "modules/nitro-chapter-list/fixtures/chapter-row-format.json")
        .map(::File)
        .first { it.exists() }
    JSONObject(file.readText())
  }

  private fun JSONArray.strings() = List(length()) { getString(it) }

  private fun formatFor(settings: JSONObject): ChapterRowFormat {
    val base = fixture.getJSONObject("baseFormat")
    return ChapterRowFormat(
      showChapterTitles = settings.getBoolean("showChapterTitles"),
      chapterTitleTemplate = base.getString("chapterTitleTemplate"),
      progressTemplate = base.getString("progressTemplate"),
      dateFormat = settings.getString("dateFormat"),
      relativeDates = settings.getBoolean("relativeTimestamps"),
      locale = base.getString("locale"),
      sameDay = base.getString("sameDay"),
      lastDay = base.getString("lastDay"),
      nextDay = base.getString("nextDay"),
      lastWeek = base.getJSONArray("lastWeek").strings(),
      nextWeek = base.getJSONArray("nextWeek").strings(),
      monthsShort = base.getJSONArray("monthsShort").strings(),
    )
  }

  /** Local wall-clock time, like dayjs parses "2026-07-25T09:00:00". */
  private fun localMillis(value: String, zone: TimeZone): Long =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT).apply { timeZone = zone }.parse(value)!!.time

  private fun rowFor(case: JSONObject, zone: TimeZone): ChapterRow {
    val row = case.getJSONObject("row")
    val releaseLocal = if (case.isNull("releaseLocal")) null else case.getString("releaseLocal")
    return ChapterRow(
      id = row.getDouble("id"),
      name = row.getString("name"),
      numberText = row.getString("numberText"),
      releaseTime = releaseLocal?.let { localMillis(it, zone).toDouble() },
      releaseText = row.getString("releaseText"),
      scanlator = row.getString("scanlator"),
      progress = row.getDouble("progress"),
      unread = row.getBoolean("unread"),
      bookmarked = row.getBoolean("bookmarked"),
      downloaded = row.getBoolean("downloaded"),
    )
  }

  @Test
  fun matchesTheJsTextInEveryCaseAndTimeZone() {
    for (zoneId in listOf("UTC", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Auckland")) {
      val zone = TimeZone.getTimeZone(zoneId)
      TimeZone.setDefault(zone)
      val now = localMillis(fixture.getString("now"), zone)
      val cases = fixture.getJSONArray("cases")
      for (i in 0 until cases.length()) {
        val case = cases.getJSONObject(i)
        val formatter =
          ChapterRowFormatter(
            formatFor(case.getJSONObject("settings")),
            timeZone = zone,
            clock = { now },
            shortDate = { error("the locale short date isn't part of the fixture") },
          )
        val row = rowFor(case, zone)
        val label = "${case.getString("name")} ($zoneId)"
        assertEquals(label, case.getString("title"), formatter.title(row))
        assertEquals(label, case.getString("subtitle"), formatter.subtitle(row))
      }
    }
  }

  @Test
  fun relativeDatesMoveOnAfterMidnight() {
    val zone = TimeZone.getTimeZone("UTC")
    val base = fixture.getJSONObject("baseFormat")
    var now = localMillis("2026-07-25T23:59:00", zone)
    val formatter =
      ChapterRowFormatter(
        ChapterRowFormat(
          sameDay = base.getString("sameDay"),
          lastDay = base.getString("lastDay"),
        ),
        timeZone = zone,
        clock = { now },
        shortDate = { "short" },
      )
    val release = localMillis("2026-07-25T09:00:00", zone)

    assertEquals("Today", formatter.releaseDate(release))
    now = localMillis("2026-07-26T00:01:00", zone)
    assertEquals("Yesterday", formatter.releaseDate(release))
  }

  @Test
  fun writesNumbersLikeJs() {
    assertEquals("40", ChapterRowFormatter.jsNumberToString(40.0))
    assertEquals("10.5", ChapterRowFormatter.jsNumberToString(10.5))
    assertEquals("-3", ChapterRowFormatter.jsNumberToString(-3.0))
  }
}
