package com.rajarsheechatterjee.background

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.rajarsheechatterjee.LNReader.R

object TaskNotificationFactory {
    const val CHANNEL_ID = "background_tasks_v2"
    const val ACTION_PAUSE = "com.rajarsheechatterjee.LNReader.background.PAUSE"
    const val ACTION_RESUME = "com.rajarsheechatterjee.LNReader.background.RESUME"
    const val ACTION_CANCEL = "com.rajarsheechatterjee.LNReader.background.CANCEL"
    const val EXTRA_TASK_ID = "taskId"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Background tasks",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Downloads, imports, backups, and library updates"
                setSound(null, null)
            },
        )
    }

    fun notificationId(taskId: String): Int = taskId.hashCode().and(Int.MAX_VALUE).coerceAtLeast(1)

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

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(task.title)
            .setContentText(task.progressText ?: task.description)
            .setContentIntent(contentIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setOngoing(task.state == BackgroundTaskState.RUNNING || task.state == BackgroundTaskState.QUEUED)
            .setAutoCancel(task.state == BackgroundTaskState.SUCCEEDED || task.state == BackgroundTaskState.FAILED)
            .setOnlyAlertOnce(true)

        if (task.state in listOf(BackgroundTaskState.QUEUED, BackgroundTaskState.RUNNING, BackgroundTaskState.PAUSED)) {
            builder.addAction(0, toggleLabel, actionIntent(context, task.id, toggleAction, 1))
                .addAction(0, "Cancel", actionIntent(context, task.id, ACTION_CANCEL, 2))
        }

        val progress = task.progress
        if (task.state == BackgroundTaskState.SUCCEEDED) {
            builder.setContentText("Completed").setProgress(0, 0, false)
        } else if (progress == null) {
            builder.setProgress(100, 0, true)
        } else {
            builder.setProgress(100, (progress.coerceIn(0.0, 1.0) * 100).toInt(), false)
        }
        return builder.build()
    }

    fun update(context: Context, task: BackgroundTaskEntity) {
        context.getSystemService(NotificationManager::class.java)
            .notify(notificationId(task.id), build(context, task))
    }

    fun dismiss(context: Context, taskId: String) {
        context.getSystemService(NotificationManager::class.java)
            .cancel(notificationId(taskId))
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
