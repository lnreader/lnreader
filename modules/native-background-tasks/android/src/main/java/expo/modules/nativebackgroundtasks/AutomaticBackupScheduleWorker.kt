package expo.modules.nativebackgroundtasks

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class AutomaticBackupScheduleWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val title = inputData.getString(AutomaticBackupScheduler.TITLE)
            ?: AutomaticBackupScheduler.DEFAULT_TITLE
        val description = inputData.getString(AutomaticBackupScheduler.DESCRIPTION)
            ?: AutomaticBackupScheduler.DEFAULT_DESCRIPTION
        val directoryUri = inputData.getString(AutomaticBackupScheduler.DIRECTORY_URI)

        return try {
            BackgroundTaskScheduler.enqueueAutomaticBackup(
                applicationContext,
                title,
                description,
                directoryUri,
            )
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}
