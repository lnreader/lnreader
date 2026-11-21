package expo.modules.nativewidgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.Text
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class ReadingStatsWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        WidgetRepository.ensureLoaded(context)
        provideContent {
            val state by WidgetRepository.state.collectAsState()
            WidgetRoot { ReadingStatsContent(state) }
        }
    }
}

class ReadingStatsWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ReadingStatsWidget()
}

internal data class DayDot(val label: String, val read: Boolean, val isToday: Boolean)

internal data class WeekStats(val chapters: Int, val days: List<DayDot>, val streak: Int)

/**
 * Computed at render time rather than in JS so the week rolls over at
 * midnight even if the app has not run since.
 */
internal fun weekStats(readDays: Map<String, Int>, now: Calendar = Calendar.getInstance()): WeekStats {
    val keyFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    val labelFormat = SimpleDateFormat("EEEEE", Locale.getDefault())
    val day = now.clone() as Calendar

    val days = ArrayList<DayDot>(7)
    var chapters = 0
    day.add(Calendar.DAY_OF_YEAR, -6)
    repeat(7) { index ->
        val count = readDays[keyFormat.format(day.time)] ?: 0
        chapters += count
        days += DayDot(labelFormat.format(day.time), count > 0, index == 6)
        day.add(Calendar.DAY_OF_YEAR, 1)
    }

    // A streak survives until the end of today, so start from yesterday when
    // nothing has been read yet today.
    val cursor = now.clone() as Calendar
    if ((readDays[keyFormat.format(cursor.time)] ?: 0) == 0) cursor.add(Calendar.DAY_OF_YEAR, -1)
    var streak = 0
    while ((readDays[keyFormat.format(cursor.time)] ?: 0) > 0) {
        streak++
        cursor.add(Calendar.DAY_OF_YEAR, -1)
    }

    return WeekStats(chapters, days, streak)
}

@Composable
private fun ReadingStatsContent(state: WidgetState) {
    val context = LocalContext.current
    val size = LocalSize.current
    val snapshot = state.snapshot
    val strings = snapshot.strings
    val stats = weekStats(snapshot.readDays)

    if (snapshot.incognito || stats.chapters == 0) {
        val message = if (snapshot.incognito) {
            incognitoMessage(context, strings)
        } else {
            Message(
                icon = R.drawable.lnr_widget_ic_local_fire_department,
                title = strings.noChaptersThisWeek,
                subtitle = strings.nothingReadDesc,
                action = strings.browse,
                onAction = WidgetLinks.browse(context),
                onClick = WidgetLinks.history(context),
            )
        }
        if (size.width >= WIDE_MIN_WIDTH) {
            WideMessage(message = message, horizontal = true)
        } else {
            CompactMessage(message)
        }
        return
    }

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .padding(start = 18.dp, top = 18.dp, end = 18.dp, bottom = 16.dp)
            .clickable(WidgetLinks.history(context)),
    ) {
        Text(
            text = strings.chaptersThisWeek,
            style = textStyle(WidgetColors.onVariant, 12.sp, medium = true),
            maxLines = 1,
        )
        Spacer(GlanceModifier.height(4.dp))
        Text(
            text = stats.chapters.toString(),
            style = textStyle(WidgetColors.on, 64.sp),
            maxLines = 1,
        )
        Spacer(GlanceModifier.defaultWeight())
        Row(modifier = GlanceModifier.fillMaxWidth()) {
            stats.days.forEach { dot ->
                Column(
                    modifier = GlanceModifier.defaultWeight(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Dot(dot)
                    Spacer(GlanceModifier.height(5.dp))
                    Text(
                        text = dot.label,
                        style = textStyle(WidgetColors.onVariant, 10.sp, medium = true),
                        maxLines = 1,
                    )
                }
            }
        }
        if (stats.streak > 0) {
            Spacer(GlanceModifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(R.drawable.lnr_widget_ic_local_fire_department, 16.dp, WidgetColors.primary)
                Spacer(GlanceModifier.width(4.dp))
                Text(
                    text = strings.streak(stats.streak),
                    style = textStyle(WidgetColors.primary, 12.sp, medium = true),
                    maxLines = 1,
                )
            }
        }
    }
}

/** 14dp dot; today gets a 2dp ring in on-surface (Glance has no borders, so it is two boxes). */
@Composable
private fun Dot(dot: DayDot) {
    val fill = if (dot.read) WidgetColors.primary else WidgetColors.track
    if (dot.isToday) {
        Box(
            modifier = GlanceModifier.size(14.dp).rounded(7.dp).background(WidgetColors.on),
            contentAlignment = Alignment.Center,
        ) {
            Box(modifier = GlanceModifier.size(10.dp).rounded(5.dp).background(fill)) {}
        }
    } else {
        Box(modifier = GlanceModifier.size(14.dp).rounded(7.dp).background(fill)) {}
    }
}
