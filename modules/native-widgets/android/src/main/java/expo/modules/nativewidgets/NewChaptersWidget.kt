package expo.modules.nativewidgets

import android.content.Context
import android.text.format.DateUtils
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.Dp
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
import androidx.glance.layout.width
import androidx.glance.text.Text
import androidx.glance.text.TextAlign

class NewChaptersWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        WidgetRepository.ensureLoaded(context)
        provideContent {
            val state by WidgetRepository.state.collectAsState()
            WidgetRoot { NewChaptersContent(state) }
        }
    }
}

// Picker entries for 4x2 and 4x4.
class NewChaptersWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NewChaptersWidget()
}

class NewChaptersLargeWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NewChaptersWidget()
}

private val LARGE_MIN_HEIGHT = 400.dp
private val FOOTER_HEIGHT = 52.dp
private const val MAX_ROWS = 6

@Composable
private fun NewChaptersContent(state: WidgetState) {
    val context = LocalContext.current
    val size = LocalSize.current
    val snapshot = state.snapshot
    val strings = snapshot.strings
    val update = state.libraryUpdate
    val large = size.height >= LARGE_MIN_HEIGHT

    // Typed vals, not inline branches: in a `when` branch `-> @Composable { }`
    // parses as an annotated block body rather than a lambda.
    val refresh: (@Composable () -> Unit)? =
        if (snapshot.incognito) null else ({ RefreshButton(updating = update != null, onClick = WidgetLinks.refreshLibrary()) })
    val badge: (@Composable () -> Unit)? = when {
        snapshot.incognito -> null
        update != null -> ({ UpdatingLabel(strings, update) })
        snapshot.updatesCount > 0 -> ({ CountBadge(snapshot.updatesCount) })
        else -> null
    }
    val header: @Composable () -> Unit = {
        WidgetHeader(
            title = strings.newChapters,
            onClick = WidgetLinks.updates(context),
            trailing = refresh,
            badge = badge,
        )
    }

    if (snapshot.incognito || snapshot.updates.isEmpty()) {
        val message = if (snapshot.incognito) {
            incognitoMessage(context, strings)
        } else {
            Message(
                icon = R.drawable.lnr_widget_ic_done_all,
                title = strings.caughtUp,
                subtitle = strings.caughtUpDesc,
                action = strings.openLibrary,
                onAction = WidgetLinks.library(context),
                onClick = WidgetLinks.updates(context),
            )
        }
        WideMessage(message = message, horizontal = !large, header = header)
        return
    }

    val rowHeight = if (large) 54.dp else WidgetDimens.minTouch
    val fitsWithoutFooter = ((size.height - WidgetDimens.headerHeight - 8.dp) / rowHeight).toInt()
    val needsFooter = large && snapshot.updatesCount > minOf(fitsWithoutFooter, snapshot.updates.size, MAX_ROWS)
    val available = size.height - WidgetDimens.headerHeight - if (needsFooter) FOOTER_HEIGHT else 8.dp
    val rows = snapshot.updates.take((available / rowHeight).toInt().coerceIn(1, MAX_ROWS))
    val remaining = snapshot.updatesCount - rows.size

    Column(modifier = GlanceModifier.fillMaxSize()) {
        header()
        Column(modifier = GlanceModifier.fillMaxWidth().defaultWeight().padding(start = 8.dp, end = 8.dp)) {
            rows.forEach { item -> UpdateRow(state, item, rowHeight) }
        }
        if (needsFooter && remaining > 0) {
            Box(
                modifier = GlanceModifier.fillMaxWidth().height(FOOTER_HEIGHT),
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    modifier = GlanceModifier
                        .height(WidgetDimens.minTouch)
                        .rounded(20.dp)
                        .padding(start = 16.dp, end = 10.dp)
                        .clickable(WidgetLinks.updates(context)),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = strings.more(remaining),
                        style = textStyle(WidgetColors.primary, 14.sp, medium = true),
                        maxLines = 1,
                    )
                    Spacer(GlanceModifier.width(2.dp))
                    Icon(R.drawable.lnr_widget_ic_chevron_right, 20.dp, WidgetColors.primary)
                }
            }
        }
    }
}

@Composable
private fun UpdateRow(state: WidgetState, item: UpdateItem, height: Dp) {
    val context = LocalContext.current
    val strings = state.snapshot.strings
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .height(height)
            .rounded(14.dp)
            .padding(start = 10.dp, end = 14.dp)
            .clickable(WidgetLinks.chapter(context, item.novelId, item.chapterId)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Cover(
            bitmap = item.cover?.let { state.thumbCovers[it] },
            width = 26.dp,
            height = 39.dp,
            radius = 5.dp,
            iconSize = 14.dp,
        )
        Spacer(GlanceModifier.width(12.dp))
        Column(modifier = GlanceModifier.defaultWeight()) {
            Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = item.novelName,
                    style = textStyle(WidgetColors.on, 14.sp, medium = true),
                    maxLines = 1,
                    modifier = GlanceModifier.defaultWeight(),
                )
                Spacer(GlanceModifier.width(10.dp))
                Text(
                    text = relativeTime(item.updatedAt),
                    style = textStyle(WidgetColors.onVariant, 12.sp),
                    maxLines = 1,
                )
            }
            Text(
                text = strings.chapterLine(item.chapterNumber, item.chapterName),
                style = textStyle(WidgetColors.onVariant, 12.sp),
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun CountBadge(count: Int) {
    Box(
        modifier = GlanceModifier
            .height(20.dp)
            .rounded(10.dp)
            .background(WidgetColors.primary)
            .padding(start = 7.dp, end = 7.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = if (count > 99) "99+" else count.toString(),
            style = textStyle(WidgetColors.onPrimary, 11.sp, medium = true, align = TextAlign.Center),
            maxLines = 1,
        )
    }
}

@Composable
private fun UpdatingLabel(strings: WidgetStrings, update: LibraryUpdateState) {
    Text(
        text = if (update.total > 0) strings.updatingProgress(update.done, update.total) else strings.updating,
        style = textStyle(WidgetColors.onVariant, 12.sp),
        maxLines = 1,
    )
}

/** System-localized ("2 hr. ago", "Yesterday"), recomputed on every render. */
private fun relativeTime(time: Long): String {
    if (time <= 0) return ""
    return DateUtils.getRelativeTimeSpanString(
        time,
        System.currentTimeMillis(),
        DateUtils.MINUTE_IN_MILLIS,
        DateUtils.FORMAT_ABBREV_RELATIVE,
    ).toString()
}
