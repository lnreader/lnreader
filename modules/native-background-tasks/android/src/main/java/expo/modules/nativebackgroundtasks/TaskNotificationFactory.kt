package expo.modules.nativebackgroundtasks

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

object TaskNotificationFactory {
    const val CHANNEL_ID = "lnreader_background_tasks"
    const val ACTION_PAUSE = "expo.modules.nativebackgroundtasks.PAUSE"
    const val ACTION_RESUME = "expo.modules.nativebackgroundtasks.RESUME"
    const val ACTION_CANCEL = "expo.modules.nativebackgroundtasks.CANCEL"
    const val EXTRA_TASK_ID = "taskId"
    private const val TERMINAL_NOTIFICATION_MASK = 0x40000000

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Background tasks",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Downloads, imports, exports, backups, and library updates"
                setSound(null, null)
            },
        )
    }

    fun notificationId(taskId: String): Int = taskId.hashCode().and(Int.MAX_VALUE).coerceAtLeast(1)

    fun terminalNotificationId(taskId: String): Int =
        notificationId(taskId).xor(TERMINAL_NOTIFICATION_MASK).coerceAtLeast(1)

    fun build(context: Context, task: BackgroundTaskEntity): Notification {
        ensureChannel(context)
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val contentIntent = launchIntent?.let {
            PendingIntent.getActivity(
                context,
                notificationId(task.id),
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        val toggleAction = if (task.state == BackgroundTaskState.PAUSED) ACTION_RESUME else ACTION_PAUSE
        val toggleLabel = if (task.state == BackgroundTaskState.PAUSED) "Resume" else "Pause"

        val notificationIconId = context.resources.getIdentifier(
            "notification_icon", "drawable", context.packageName
        )
        val icon = if (notificationIconId != 0) notificationIconId else android.R.drawable.ic_dialog_info

        val progressLines = task.progressText
            ?.lineSequence()
            ?.filter { it.isNotBlank() }
            ?.toList()
            .orEmpty()
        val contentText = progressLines.firstOrNull() ?: task.description

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(icon)
            .setContentTitle(task.title)
            .setContentText(contentText)
            .setContentIntent(contentIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(
                if (task.state in listOf(BackgroundTaskState.SUCCEEDED, BackgroundTaskState.FAILED)) {
                    NotificationCompat.CATEGORY_STATUS
                } else {
                    NotificationCompat.CATEGORY_PROGRESS
                },
            )
            .setOngoing(task.state == BackgroundTaskState.RUNNING || task.state == BackgroundTaskState.QUEUED)
            .setAutoCancel(task.state == BackgroundTaskState.SUCCEEDED || task.state == BackgroundTaskState.FAILED)
            .setOnlyAlertOnce(true)

        if (task.state in listOf(BackgroundTaskState.QUEUED, BackgroundTaskState.RUNNING, BackgroundTaskState.PAUSED)) {
            builder.addAction(0, toggleLabel, actionIntent(context, task.id, toggleAction, 1))
                .addAction(0, "Cancel", actionIntent(context, task.id, ACTION_CANCEL, 2))
        }

        val progress = task.progress
        if (task.state == BackgroundTaskState.SUCCEEDED) {
            builder.setContentText(contentText).setProgress(0, 0, false)
        } else if (task.state == BackgroundTaskState.FAILED) {
            builder.setContentText(contentText).setProgress(0, 0, false)
        } else if (progress == null) {
            builder.setProgress(100, 0, true)
        } else {
            builder.setProgress(100, (progress.coerceIn(0.0, 1.0) * 100).toInt(), false)
        }

        if (
            task.state in listOf(BackgroundTaskState.SUCCEEDED, BackgroundTaskState.FAILED) &&
            contentText.isNotBlank()
        ) {
            builder.setStyle(NotificationCompat.BigTextStyle().bigText(contentText))
        }

        if (
            task.type == "UPDATE_LIBRARY" &&
            task.state in listOf(BackgroundTaskState.QUEUED, BackgroundTaskState.RUNNING, BackgroundTaskState.PAUSED) &&
            progressLines.size > 1
        ) {
            builder.setStyle(
                NotificationCompat.InboxStyle().also { style ->
                    progressLines.forEach(style::addLine)
                },
            )
        }

        return builder.build()
    }

    fun update(context: Context, task: BackgroundTaskEntity) {
        context.getSystemService(NotificationManager::class.java)
            .notify(notificationId(task.id), build(context, task))
    }

    fun postTerminal(context: Context, task: BackgroundTaskEntity) {
        require(task.state in listOf(BackgroundTaskState.SUCCEEDED, BackgroundTaskState.FAILED))
        context.getSystemService(NotificationManager::class.java)
            .notify(terminalNotificationId(task.id), build(context, task))
    }

    fun dismiss(context: Context, taskId: String) {
        context.getSystemService(NotificationManager::class.java).apply {
            cancel(notificationId(taskId))
            cancel(terminalNotificationId(taskId))
        }
    }

    private fun actionIntent(
        context: Context,
        taskId: String,
        action: String,
        requestOffset: Int,
    ): PendingIntent = PendingIntent.getBroadcast(
        context,
        notificationId(taskId) + requestOffset,
        Intent(context, TaskActionReceiver::class.java).apply {
            this.action = action
            putExtra(EXTRA_TASK_ID, taskId)
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}
