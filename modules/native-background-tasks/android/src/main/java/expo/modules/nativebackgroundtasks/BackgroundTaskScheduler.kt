package expo.modules.nativebackgroundtasks

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import androidx.work.Data
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.UUID

object BackgroundTaskScheduler {
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
            task.queueName,
            ExistingWorkPolicy.APPEND_OR_REPLACE,
            request,
        )
        return request.id
    }

    suspend fun enqueueLibraryUpdate(
        context: Context,
        title: String,
        description: String,
    ): UUID? {
        val dao = BackgroundTaskDatabase.get(context).tasks()
        if (dao.getActiveByType(LIBRARY_UPDATE_TASK_TYPE) != null) {
            return null
        }

        val now = System.currentTimeMillis()
        val task = BackgroundTaskEntity(
            id = UUID.randomUUID().toString(),
            type = LIBRARY_UPDATE_TASK_TYPE,
            payload = """{"name":"$LIBRARY_UPDATE_TASK_TYPE"}""",
            title = title,
            description = description,
            queueName = "lnreader-background-task:task:$LIBRARY_UPDATE_TASK_TYPE",
            state = BackgroundTaskState.QUEUED,
            progress = null,
            progressText = null,
            checkpoint = null,
            attempt = 0,
            workId = null,
            createdAt = now,
            updatedAt = now,
        )
        dao.insert(task)
        return enqueue(context, task.id)
    }

    suspend fun enqueueAutomaticBackup(
        context: Context,
        title: String,
        description: String,
        directoryUri: String?,
    ): UUID? {
        val dao = BackgroundTaskDatabase.get(context).tasks()
        if (dao.getActiveByType(LOCAL_BACKUP_TASK_TYPE) != null) {
            return null
        }

        val filename = "lnreader_backup_${System.currentTimeMillis()}.zip"
        val destination = if (directoryUri != null) {
            val treeUri = Uri.parse(directoryUri)
            val documentId = DocumentsContract.getTreeDocumentId(treeUri)
            val parentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
            DocumentsContract.createDocument(
                context.contentResolver,
                parentUri,
                "application/zip",
                filename,
            )?.toString() ?: throw IllegalStateException(
                "Could not create a backup in the selected directory",
            )
        } else {
            val backupDirectory = context.getExternalFilesDir(null)?.resolve("Backups")
                ?: throw IllegalStateException("External files directory is unavailable")
            if (!backupDirectory.exists() && !backupDirectory.mkdirs()) {
                throw IllegalStateException("Could not create automatic backup directory")
            }
            backupDirectory.resolve(filename).absolutePath
        }
        val escapedDestination = destination
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
        val now = System.currentTimeMillis()
        val task = BackgroundTaskEntity(
            id = UUID.randomUUID().toString(),
            type = LOCAL_BACKUP_TASK_TYPE,
            payload = """{"name":"$LOCAL_BACKUP_TASK_TYPE","data":{"destinationUri":"$escapedDestination","automatic":true}}""",
            title = title,
            description = description,
            queueName = "lnreader-background-task:task:$LOCAL_BACKUP_TASK_TYPE",
            state = BackgroundTaskState.QUEUED,
            progress = null,
            progressText = null,
            checkpoint = null,
            attempt = 0,
            workId = null,
            createdAt = now,
            updatedAt = now,
        )
        dao.insert(task)
        return enqueue(context, task.id)
    }

    private val NETWORK_TASKS = setOf(
        LIBRARY_UPDATE_TASK_TYPE,
        "DRIVE_BACKUP",
        "DRIVE_RESTORE",
        "SELF_HOST_BACKUP",
        "SELF_HOST_RESTORE",
        "MIGRATE_NOVEL",
        "DOWNLOAD_CHAPTER",
    )

    private const val LIBRARY_UPDATE_TASK_TYPE = "UPDATE_LIBRARY"
    private const val LOCAL_BACKUP_TASK_TYPE = "LOCAL_BACKUP"
}
