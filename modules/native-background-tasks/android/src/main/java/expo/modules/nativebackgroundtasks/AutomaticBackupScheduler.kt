package expo.modules.nativebackgroundtasks

import android.content.Context
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object AutomaticBackupScheduler {
    const val TITLE = "title"
    const val DESCRIPTION = "description"
    const val DIRECTORY_URI = "directoryUri"
    const val DEFAULT_TITLE = "Local Backup"
    const val DEFAULT_DESCRIPTION = "Preparing"

    private const val WORK_NAME = "lnreader-automatic-backup"
    private val allowedIntervals = setOf(6L, 12L, 24L, 48L, 168L)

    fun schedule(
        context: Context,
        intervalHours: Long,
        title: String,
        description: String,
        directoryUri: String?,
    ) {
        require(intervalHours in allowedIntervals) {
            "Unsupported automatic backup interval: $intervalHours"
        }

        val request =
            PeriodicWorkRequestBuilder<AutomaticBackupScheduleWorker>(
                intervalHours,
                TimeUnit.HOURS,
            )
                .setInitialDelay(intervalHours, TimeUnit.HOURS)
                .setInputData(
                    Data.Builder()
                        .putString(TITLE, title)
                        .putString(DESCRIPTION, description)
                        .putString(DIRECTORY_URI, directoryUri)
                        .build(),
                )
                .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.CANCEL_AND_REENQUEUE,
            request,
        )
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }
}
