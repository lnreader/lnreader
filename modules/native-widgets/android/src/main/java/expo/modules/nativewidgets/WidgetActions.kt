package expo.modules.nativewidgets

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.glance.GlanceId
import androidx.glance.action.Action
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import expo.modules.nativebackgroundtasks.BackgroundTaskScheduler

/**
 * Taps open `lnreader://widget/<target>`; src/navigators/WidgetIntentHandler.tsx
 * turns those into navigation. Each target has a distinct URI, so the
 * PendingIntents Glance creates never collide.
 */
internal object WidgetLinks {
    private fun open(context: Context, target: String, query: Map<String, Any> = emptyMap()): Action {
        val uri = Uri.Builder()
            .scheme("lnreader")
            .authority("widget")
            .appendPath(target)
            .apply { query.forEach { (key, value) -> appendQueryParameter(key, value.toString()) } }
            .build()
        val intent = Intent(Intent.ACTION_VIEW, uri)
            .setPackage(context.packageName)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return actionStartActivity(intent)
    }

    fun chapter(context: Context, novelId: Long, chapterId: Long) =
        open(context, "chapter", mapOf("novelId" to novelId, "chapterId" to chapterId))

    fun updates(context: Context) = open(context, "updates")
    fun library(context: Context) = open(context, "library")
    fun browse(context: Context) = open(context, "browse")
    fun history(context: Context) = open(context, "history")
    fun search(context: Context) = open(context, "search")
    fun random(context: Context) = open(context, "random")
    fun downloads(context: Context) = open(context, "downloads")

    fun refreshLibrary(): Action = actionRunCallback<RefreshLibraryAction>()
}

/**
 * Starts a library update without opening the app. The update itself runs in
 * the existing background task queue (headless JS), which reports progress
 * back through `NativeWidgets.setLibraryUpdateState`.
 */
class RefreshLibraryAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        if (WidgetRepository.isLibraryUpdateRunning(context)) return
        WidgetRepository.ensureLoaded(context)

        // Spin immediately; the JS task replaces this with real progress.
        WidgetRepository.saveLibraryUpdate(context, running = true, done = 0, total = 0)
        WidgetRepository.refreshLibraryUpdate(context)

        val strings = WidgetRepository.state.value.snapshot.strings
        try {
            BackgroundTaskScheduler.enqueueLibraryUpdate(
                context,
                strings.updateNotificationTitle,
                strings.updateNotificationDescription,
            )
        } catch (_: Exception) {
            WidgetRepository.saveLibraryUpdate(context, running = false, done = 0, total = 0)
            WidgetRepository.refreshLibraryUpdate(context)
        }
    }
}
