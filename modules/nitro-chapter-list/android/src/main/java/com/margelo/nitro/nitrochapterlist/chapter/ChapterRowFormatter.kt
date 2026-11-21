package com.margelo.nitro.nitrochapterlist.chapter

import android.os.Build
import com.margelo.nitro.nitrochapterlist.ChapterRow
import java.util.Calendar
import java.util.Date
import java.util.GregorianCalendar
import java.util.Locale
import java.util.TimeZone

/** The `rowFormat` prop. JS supplies every translated or locale-specific string. */
data class ChapterRowFormat(
  val showChapterTitles: Boolean = false,
  val chapterTitleTemplate: String = "Chapter %{num}",
  val progressTemplate: String = "Progress %{progress} %",
  val dateFormat: String = DEFAULT_DATE_FORMAT,
  val relativeDates: Boolean = true,
  val locale: String = "en",
  val sameDay: String = "Today",
  val lastDay: String = "Yesterday",
  val nextDay: String = "Tomorrow",
  /** Index 0 is Sunday, as JS `Date#getDay`. */
  val lastWeek: List<String> = emptyList(),
  val nextWeek: List<String> = emptyList(),
  val monthsShort: List<String> = emptyList(),
) {
  companion object {
    const val DEFAULT_DATE_FORMAT = "default"
  }
}

/**
 * Builds a chapter row's title and subtitle the way `ChapterItem` does in JS:
 * the same relative-date rule as `formatDate` (calendar days -6..6 from today),
 * the same dayjs date patterns, and the same " •  " joins. Formatted dates are
 * cached per local calendar day; "today" follows the clock, so relative labels
 * stay right after midnight.
 *
 * Main-thread only. [shortDate] formats the locale's short date (JS
 * `Intl.DateTimeFormat(locale, { dateStyle: 'short' })`).
 */
class ChapterRowFormatter(
  val format: ChapterRowFormat,
  private val timeZone: TimeZone = TimeZone.getDefault(),
  private val clock: () -> Long = System::currentTimeMillis,
  private val shortDate: (Long) -> String = localeShortDate(format.locale, timeZone),
) {
  private val calendar = GregorianCalendar(timeZone)
  private val dateCache = HashMap<Long, String>()
  private var cachedToday = Long.MIN_VALUE
  private val parts = StringBuilder()

  fun title(row: ChapterRow): String =
    if (format.showChapterTitles) row.name else format.chapterTitleTemplate.replace("%{num}", row.numberText)

  fun subtitle(row: ChapterRow): String {
    parts.setLength(0)
    val releaseTime = row.releaseTime
    if (releaseTime != null) {
      append(releaseDate(releaseTime.toLong()))
    } else if (row.releaseText.isNotEmpty()) {
      append(row.releaseText)
    }
    if (row.scanlator.isNotEmpty()) append(row.scanlator)
    if (row.unread && row.progress > 0) {
      append(format.progressTemplate.replace("%{progress}", jsNumberToString(row.progress)))
    }
    return parts.toString()
  }

  private fun append(part: String) {
    if (parts.isNotEmpty()) parts.append(SEPARATOR)
    parts.append(part)
  }

  /** The release date part of the subtitle. */
  fun releaseDate(epochMs: Long): String {
    val today = localDay(clock())
    if (today != cachedToday) {
      cachedToday = today
      dateCache.clear()
    }
    val day = localDay(epochMs)
    return dateCache.getOrPut(day) { formatDay(day, epochMs, today) }
  }

  private fun formatDay(day: Long, epochMs: Long, today: Long): String {
    val offset = day - today
    if (format.relativeDates && offset in -6L..6L) {
      val weekday = Math.floorMod(day + THURSDAY, 7L).toInt()
      when {
        offset == 0L -> return format.sameDay
        offset == -1L -> return format.lastDay
        offset == 1L -> return format.nextDay
        offset < 0L -> format.lastWeek.getOrNull(weekday)?.let { return it }
        else -> format.nextWeek.getOrNull(weekday)?.let { return it }
      }
    }
    if (format.dateFormat == ChapterRowFormat.DEFAULT_DATE_FORMAT) return shortDate(epochMs)
    calendar.timeInMillis = epochMs
    return formatPattern(
      format.dateFormat,
      calendar.get(Calendar.YEAR),
      calendar.get(Calendar.MONTH),
      calendar.get(Calendar.DAY_OF_MONTH),
    )
  }

  /** Days since 1970-01-01 in [timeZone]. */
  private fun localDay(epochMs: Long): Long = Math.floorDiv(epochMs + timeZone.getOffset(epochMs), DAY_MS)

  /** The dayjs tokens the app's date formats use; everything else is literal. */
  private fun formatPattern(pattern: String, year: Int, month: Int, dayOfMonth: Int): String {
    val out = StringBuilder(pattern.length + 4)
    var i = 0
    while (i < pattern.length) {
      when {
        pattern.startsWith("YYYY", i) -> {
          out.append(year.toString().padStart(4, '0'))
          i += 4
        }
        pattern.startsWith("YY", i) -> {
          out.append(year.toString().takeLast(2))
          i += 2
        }
        pattern.startsWith("MMM", i) -> {
          out.append(format.monthsShort.getOrNull(month) ?: (month + 1).toString())
          i += 3
        }
        pattern.startsWith("MM", i) -> {
          out.append((month + 1).toString().padStart(2, '0'))
          i += 2
        }
        pattern.startsWith("DD", i) -> {
          out.append(dayOfMonth.toString().padStart(2, '0'))
          i += 2
        }
        else -> out.append(pattern[i++])
      }
    }
    return out.toString()
  }

  companion object {
    const val SEPARATOR = " •  "
    private const val DAY_MS = 24L * 60 * 60 * 1000

    // 1970-01-01 was a Thursday (Sunday = 0).
    private const val THURSDAY = 4L

    /** `String(n)` in JS for the numbers rows carry: no ".0" on whole numbers. */
    fun jsNumberToString(value: Double): String =
      if (value == Math.rint(value) && Math.abs(value) < 1e15) value.toLong().toString() else value.toString()

    /**
     * The locale's short date. Hermes implements `Intl.DateTimeFormat` on top of
     * Android's ICU, so this should match JS; it's the one part a device check
     * has to confirm.
     */
    fun localeShortDate(locale: String, timeZone: TimeZone): (Long) -> String {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        val formatter =
          android.icu.text.DateFormat.getDateInstance(
            android.icu.text.DateFormat.SHORT,
            android.icu.util.ULocale.forLanguageTag(locale),
          )
        formatter.timeZone = android.icu.util.TimeZone.getTimeZone(timeZone.id)
        return { formatter.format(Date(it)) }
      }
      val formatter = java.text.DateFormat.getDateInstance(java.text.DateFormat.SHORT, Locale.forLanguageTag(locale))
      formatter.timeZone = timeZone
      return { formatter.format(Date(it)) }
    }
  }
}
