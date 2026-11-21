package expo.modules.nativewidgets

import android.content.Context
import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.CircularProgressIndicator
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.RowScope
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.Text

class QuickActionsWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        WidgetRepository.ensureLoaded(context)
        provideContent {
            val state by WidgetRepository.state.collectAsState()
            WidgetRoot { QuickActionsContent(state) }
        }
    }
}

class QuickActionsWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = QuickActionsWidget()
}

@Composable
private fun QuickActionsContent(state: WidgetState) {
    val context = LocalContext.current
    val strings = state.snapshot.strings
    val updating = state.libraryUpdate != null

    Row(modifier = GlanceModifier.fillMaxSize().padding(12.dp)) {
        ActionTile(R.drawable.lnr_widget_ic_search, strings.search, WidgetLinks.search(context))
        Spacer(GlanceModifier.width(8.dp))
        ActionTile(R.drawable.lnr_widget_ic_shuffle, strings.random, WidgetLinks.random(context))
        Spacer(GlanceModifier.width(8.dp))
        ActionTile(R.drawable.lnr_widget_ic_download, strings.downloads, WidgetLinks.downloads(context))
        Spacer(GlanceModifier.width(8.dp))
        ActionTile(
            icon = R.drawable.lnr_widget_ic_sync,
            label = if (updating) strings.updating else strings.update,
            onClick = WidgetLinks.refreshLibrary(),
            spinning = updating,
        )
    }
}

@Composable
private fun RowScope.ActionTile(
    @DrawableRes icon: Int,
    label: String,
    onClick: Action,
    spinning: Boolean = false,
) {
    Column(
        modifier = GlanceModifier
            .defaultWeight()
            .fillMaxHeight()
            .rounded(14.dp)
            .background(WidgetColors.hi)
            .clickable(onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (spinning) {
            CircularProgressIndicator(modifier = GlanceModifier.size(24.dp), color = WidgetColors.primary)
        } else {
            Icon(icon, 24.dp, WidgetColors.primary)
        }
        Spacer(GlanceModifier.height(4.dp))
        Text(text = label, style = textStyle(WidgetColors.on, 12.sp, medium = true), maxLines = 1)
    }
}
