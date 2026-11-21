package expo.modules.nativewidgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.min
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
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
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.Text

class ContinueReadingWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        WidgetRepository.ensureLoaded(context)
        provideContent {
            val state by WidgetRepository.state.collectAsState()
            WidgetRoot { ContinueReadingContent(state) }
        }
    }
}

// One receiver per picker entry (2x2, 4x2, 4x3). They share the widget, so
// any of them adapts if the user resizes it.
class ContinueReadingWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ContinueReadingWidget()
}

class ContinueReadingMediumWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ContinueReadingWidget()
}

class ContinueReadingLargeWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ContinueReadingWidget()
}

private val LIST_ROW_HEIGHT = 64.dp

@Composable
private fun ContinueReadingContent(state: WidgetState) {
    val context = LocalContext.current
    val size = LocalSize.current
    val strings = state.snapshot.strings
    val wide = size.width >= WIDE_MIN_WIDTH
    val tall = size.height >= CONTINUE_TALL_MIN_HEIGHT

    val message = when {
        state.snapshot.incognito -> incognitoMessage(context, strings)
        state.snapshot.reading.isEmpty() -> Message(
            icon = R.drawable.lnr_widget_ic_auto_stories,
            title = strings.nothingRead,
            subtitle = strings.nothingReadDesc,
            action = strings.browse,
            onAction = WidgetLinks.browse(context),
            onClick = WidgetLinks.browse(context),
        )
        else -> null
    }

    when {
        message != null && !wide -> CompactMessage(message)
        message != null -> WideMessage(
            message = message,
            horizontal = !tall,
            header = if (tall) continueHeader(strings) else null,
        )
        !wide -> CoverLayout(state)
        !tall -> DetailLayout(state)
        else -> ListLayout(state)
    }
}

/** 2x2: full-bleed cover, scrim, title, chapter and a progress bar. */
@Composable
private fun CoverLayout(state: WidgetState) {
    val context = LocalContext.current
    val size = LocalSize.current
    val item = state.snapshot.reading.first()
    val cover = item.cover?.let { state.heroCovers[it] }

    Box(
        modifier = GlanceModifier.fillMaxSize().clickable(WidgetLinks.chapter(context, item.novelId, item.chapterId)),
        contentAlignment = Alignment.BottomStart,
    ) {
        if (cover != null) {
            Image(
                provider = ImageProvider(cover),
                contentDescription = item.novelName,
                modifier = GlanceModifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        } else {
            Box(
                modifier = GlanceModifier.fillMaxSize().background(WidgetColors.primaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Icon(R.drawable.lnr_widget_ic_menu_book, 48.dp, WidgetColors.onPrimaryContainer)
            }
        }
        Box(
            modifier = GlanceModifier
                .fillMaxWidth()
                .height(132.dp)
                .background(ImageProvider(R.drawable.lnr_widget_scrim)),
        ) {}
        Column(modifier = GlanceModifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, bottom = 14.dp)) {
            Text(
                text = item.novelName,
                style = textStyle(WidgetColors.onCover, 16.sp, medium = true),
                maxLines = 1,
            )
            Spacer(GlanceModifier.height(2.dp))
            Text(
                text = strings(state).chapterLabel(item.chapterNumber, item.chapterName),
                style = textStyle(WidgetColors.onCoverVariant, 12.sp),
                maxLines = 1,
            )
            Spacer(GlanceModifier.height(10.dp))
            ProgressBar(
                progress = item.barProgress,
                width = size.width - 28.dp,
                track = WidgetColors.coverTrack,
            )
        }
    }
}

/** 4x2: cover on the left; title, chapter name, progress and Resume on the right. */
@Composable
private fun DetailLayout(state: WidgetState) {
    val context = LocalContext.current
    val size = LocalSize.current
    val strings = strings(state)
    val item = state.snapshot.reading.first()
    val open = WidgetLinks.chapter(context, item.novelId, item.chapterId)

    val coverHeight = size.height - 24.dp
    val coverWidth = min(coverHeight * 2f / 3f, (size.width - 24.dp) * 0.4f)
    val textWidth = size.width - 24.dp - coverWidth - 16.dp - 6.dp

    Row(modifier = GlanceModifier.fillMaxSize().padding(12.dp).clickable(open)) {
        Cover(
            bitmap = item.cover?.let { state.heroCovers[it] ?: state.thumbCovers[it] },
            width = coverWidth,
            height = coverHeight,
            radius = 14.dp,
            iconSize = 40.dp,
        )
        Spacer(GlanceModifier.width(16.dp))
        Column(modifier = GlanceModifier.defaultWeight().fillMaxHeight().padding(top = 6.dp, end = 6.dp)) {
            Text(
                text = item.novelName,
                style = textStyle(WidgetColors.on, 16.sp, medium = true),
                maxLines = 2,
            )
            Spacer(GlanceModifier.height(4.dp))
            Text(
                text = item.chapterName,
                style = textStyle(WidgetColors.onVariant, 12.sp),
                maxLines = 1,
            )
            Spacer(GlanceModifier.defaultWeight())
            Text(
                text = progressLabel(strings, item),
                style = textStyle(WidgetColors.onVariant, 12.sp),
                maxLines = 1,
            )
            Spacer(GlanceModifier.height(8.dp))
            ProgressBar(progress = item.barProgress, width = textWidth)
            Spacer(GlanceModifier.height(4.dp))
            PillButton(
                text = strings.resume,
                onClick = open,
                container = WidgetColors.primary,
                content = WidgetColors.onPrimary,
                icon = R.drawable.lnr_widget_ic_play_arrow,
            )
        }
    }
}

/** 4x3: header plus the last few novels in progress. */
@Composable
private fun ListLayout(state: WidgetState) {
    val context = LocalContext.current
    val size = LocalSize.current
    val strings = strings(state)
    val rowCount = ((size.height - WidgetDimens.headerHeight - 12.dp) / LIST_ROW_HEIGHT).toInt().coerceIn(1, 4)
    // padding 8 + row padding 10/12 + cover 36 + gap 12 + padding 8
    val barWidth = size.width - 16.dp - 22.dp - 36.dp - 12.dp

    Column(modifier = GlanceModifier.fillMaxSize()) {
        WidgetHeader(title = strings.continueReading, onClick = WidgetLinks.history(context))
        Column(modifier = GlanceModifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, bottom = 12.dp)) {
            state.snapshot.reading.take(rowCount).forEach { item ->
                Row(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .height(LIST_ROW_HEIGHT)
                        .rounded(16.dp)
                        .padding(start = 10.dp, end = 12.dp)
                        .clickable(WidgetLinks.chapter(context, item.novelId, item.chapterId)),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Cover(
                        bitmap = item.cover?.let { state.thumbCovers[it] },
                        width = 36.dp,
                        height = 54.dp,
                        radius = 6.dp,
                        iconSize = 18.dp,
                    )
                    Spacer(GlanceModifier.width(12.dp))
                    Column(modifier = GlanceModifier.defaultWeight()) {
                        Text(
                            text = item.novelName,
                            style = textStyle(WidgetColors.on, 14.sp, medium = true),
                            maxLines = 1,
                        )
                        Text(
                            text = strings.chapterLine(item.chapterNumber, item.chapterName),
                            style = textStyle(WidgetColors.onVariant, 12.sp),
                            maxLines = 1,
                        )
                        Spacer(GlanceModifier.height(7.dp))
                        ProgressBar(progress = item.barProgress, width = barWidth)
                    }
                }
            }
        }
    }
}

private fun strings(state: WidgetState) = state.snapshot.strings

private fun continueHeader(strings: WidgetStrings): @Composable () -> Unit = {
    WidgetHeader(title = strings.continueReading, onClick = null)
}

private fun progressLabel(strings: WidgetStrings, item: ReadingItem): String {
    val progress = item.novelProgress
    val percent = ((progress ?: 0f) * 100).toInt()
    return when {
        progress == null || item.chapterNumber.isEmpty() ->
            strings.chapterLabel(item.chapterNumber, item.chapterName)
        item.showTotal -> strings.chapterProgress(item.chapterNumber, item.totalChapters, percent)
        // Numbering that skips or starts late: "Ch. 412 of 100" would be wrong.
        else -> strings.chapterPercent(item.chapterNumber, percent)
    }
}

internal fun incognitoMessage(context: Context, strings: WidgetStrings) = Message(
    icon = R.drawable.lnr_widget_ic_visibility_off,
    title = strings.incognito,
    subtitle = strings.incognitoDesc,
    action = null,
    onAction = null,
    onClick = WidgetLinks.library(context),
)

/** Below this the widget is a 2-column widget. */
internal val WIDE_MIN_WIDTH = 250.dp
private val CONTINUE_TALL_MIN_HEIGHT = 280.dp
