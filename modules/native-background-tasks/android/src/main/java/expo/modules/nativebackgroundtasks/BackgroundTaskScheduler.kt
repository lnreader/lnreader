package expo.modules.nativebackgroundtasks

import android.content.Context
import androidx.work.Data
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.UUID

object BackgroundTaskScheduler {
    private const val QUEUE_NAME = "lnreader-background-task-queue"
    const val TASK_ID = "taskId"

    suspend fun enqueue(context: Context, taskId: String): UUID {
        val task = BackgroundTaskDatabase.get(context).tasks().get(taskId)
            ?: throw IllegalArgumentException("Unknown background task: $taskId")
        val requestBuilder = OneTimeWorkRequestBuilder<LNReaderTaskWorker>()
            .setInputData(Data.Builder().putString(TASK_ID, taskId).build())
            .addTag(taskId)
        if (task.type in NETWORK_TASKS) {
            requestBuilder.setConstraints(
                Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
            )
        }
        val request = requestBuilder.build()
        BackgroundTaskDatabase.get(context).tasks()
            .assignWork(taskId, request.id.toString(), System.currentTimeMillis())
        WorkManager.getInstance(context).enqueueUniqueWork(
            QUEUE_NAME,
            ExistingWorkPolicy.APPEND_OR_REPLACE,
            request,
        )
        return request.id
    }

    private val NETWORK_TASKS = setOf(
        "UPDATE_LIBRARY",
        "DRIVE_BACKUP",
        "DRIVE_RESTORE",
        "SELF_HOST_BACKUP",
        "SELF_HOST_RESTORE",
        "MIGRATE_NOVEL",
        "DOWNLOAD_CHAPTER",
    )
}