package expo.modules.nativebackgroundtasks

import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext

class LNReaderTaskWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val taskId = inputData.getString(BackgroundTaskScheduler.TASK_ID) ?: return Result.failure()
        val dao = BackgroundTaskDatabase.get(applicationContext).tasks()
        val task = dao.get(taskId) ?: return Result.success()
        if (task.state == BackgroundTaskState.CANCELLED) {
            consumeCancellation(dao, taskId)
            return Result.success()
        }
        if (task.state == BackgroundTaskState.PAUSED) {
            return Result.success()
        }

        val claimed = dao.tryMarkRunning(
            taskId,
            BackgroundTaskState.RUNNING,
            System.currentTimeMillis(),
            MAX_CONCURRENT_DOWNLOADS,
        )
        if (claimed == 0) {
            return when (dao.get(taskId)?.state) {
                BackgroundTaskState.QUEUED -> Result.retry()
                BackgroundTaskState.CANCELLED -> {
                    consumeCancellation(dao, taskId)
                    Result.success()
                }
                else -> Result.success()
            }
        }
        val runningTask = dao.get(taskId) ?: return Result.success()
        if (runningTask.state != BackgroundTaskState.RUNNING) {
            if (runningTask.state == BackgroundTaskState.CANCELLED) {
                consumeCancellation(dao, taskId)
            }
            return Result.success()
        }

        setForeground(createForegroundInfo(runningTask))
        val execution = TaskExecutionRegistry.register(taskId)

        return try {
            applicationContext.startService(
                Intent(applicationContext, LNReaderHeadlessTaskService::class.java).apply {
                    putExtra(BackgroundTaskScheduler.TASK_ID, runningTask.id)
                },
            )

            when (val executionResult = execution.await()) {
                TaskExecutionResult.Success -> {
                    if (dao.finishRunning(taskId, BackgroundTaskState.SUCCEEDED, System.currentTimeMillis()) > 0) {
                        postOwnedTerminal(taskId, dao, BackgroundTaskState.SUCCEEDED)
                    } else {
                        resultAfterLostOwnership(taskId, dao)
                    }
                    Result.success()
                }
                is TaskExecutionResult.Failure -> {
                    if (executionResult.shouldRetry) {
                        if (dao.finishRunning(taskId, BackgroundTaskState.QUEUED, System.currentTimeMillis()) > 0) {
                            Result.retry()
                        } else {
                            resultAfterLostOwnership(taskId, dao)
                        }
                    } else if (
                        dao.finishRunning(taskId, BackgroundTaskState.FAILED, System.currentTimeMillis()) > 0
                    ) {
                        postOwnedTerminal(taskId, dao, BackgroundTaskState.FAILED)
                        Result.success()
                    } else {
                        resultAfterLostOwnership(taskId, dao)
                    }
                }
            }
        } catch (error: CancellationException) {
            withContext(NonCancellable) {
                when (dao.get(taskId)?.state) {
                    BackgroundTaskState.CANCELLED -> consumeCancellation(dao, taskId)
                    BackgroundTaskState.RUNNING -> dao.finishRunning(
                        taskId,
                        BackgroundTaskState.QUEUED,
                        System.currentTimeMillis(),
                    )
                    else -> Unit
                }
            }
            throw error
        } catch (error: Exception) {
            val now = System.currentTimeMillis()
            val message = error.message ?: error.javaClass.simpleName
            if (
                dao.finishRunningWithProgress(
                    taskId,
                    BackgroundTaskState.FAILED,
                    null,
                    message,
                    now,
                ) > 0
            ) {
                postOwnedTerminal(taskId, dao, BackgroundTaskState.FAILED)
                Result.failure()
            } else {
                when (dao.get(taskId)?.state) {
                    BackgroundTaskState.CANCELLED -> {
                        consumeCancellation(dao, taskId)
                        Result.success()
                    }
                    BackgroundTaskState.PAUSED -> Result.success()
                    else -> Result.failure()
                }
            }
        } finally {
            TaskExecutionRegistry.cancel(taskId)
        }
    }

    private suspend fun resultAfterLostOwnership(
        taskId: String,
        dao: BackgroundTaskDao,
    ): Result {
        return when (dao.get(taskId)?.state) {
            BackgroundTaskState.CANCELLED -> {
                consumeCancellation(dao, taskId)
                Result.success()
            }
            BackgroundTaskState.PAUSED -> {
                dao.get(taskId)?.let { TaskNotificationFactory.update(applicationContext, it) }
                Result.success()
            }
            else -> Result.success()
        }
    }

    private suspend fun postOwnedTerminal(
        taskId: String,
        dao: BackgroundTaskDao,
        state: String,
    ) {
        val terminalTask = dao.get(taskId) ?: return
        if (terminalTask.state != state) return
        TaskNotificationFactory.postTerminal(applicationContext, terminalTask)
        dao.deleteIfState(taskId, state)
    }

    private suspend fun consumeCancellation(dao: BackgroundTaskDao, taskId: String) {
        if (dao.deleteIfState(taskId, BackgroundTaskState.CANCELLED) > 0) {
            TaskNotificationFactory.dismiss(applicationContext, taskId)
        }
    }

    private fun createForegroundInfo(task: BackgroundTaskEntity): ForegroundInfo {
        val id = TaskNotificationFactory.notificationId(task.id)
        val notification = TaskNotificationFactory.build(applicationContext, task)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(id, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            ForegroundInfo(id, notification)
        }
    }

    companion object {
        private const val MAX_CONCURRENT_DOWNLOADS = 3
    }
}
