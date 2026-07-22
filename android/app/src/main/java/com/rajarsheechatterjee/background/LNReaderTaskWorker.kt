package com.rajarsheechatterjee.background

import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException

class LNReaderTaskWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val taskId = inputData.getString(BackgroundTaskScheduler.TASK_ID) ?: return Result.failure()
        val dao = BackgroundTaskDatabase.get(applicationContext).tasks()
        val task = dao.get(taskId) ?: return Result.failure()
        if (task.state == BackgroundTaskState.CANCELLED || task.state == BackgroundTaskState.PAUSED) {
            return Result.success()
        }

        dao.markRunning(taskId, BackgroundTaskState.RUNNING, System.currentTimeMillis())
        val runningTask = dao.get(taskId) ?: return Result.failure()
        setForeground(createForegroundInfo(runningTask))
        val execution = TaskExecutionRegistry.register(taskId)

        applicationContext.startService(
            Intent(applicationContext, LNReaderHeadlessTaskService::class.java).apply {
                putExtra("taskId", runningTask.id)
                putExtra("type", runningTask.type)
                putExtra("payload", runningTask.payload)
            },
        )

        return try {
            when (val executionResult = execution.await()) {
                TaskExecutionResult.Success -> {
                    val currentState = dao.get(taskId)?.state
                    if (currentState == BackgroundTaskState.CANCELLED) {
                        TaskNotificationFactory.dismiss(applicationContext, taskId)
                        return Result.success()
                    }
                    if (currentState == BackgroundTaskState.PAUSED) {
                        dao.get(taskId)?.let { TaskNotificationFactory.update(applicationContext, it) }
                        return Result.success()
                    }
                    dao.finishRunning(taskId, BackgroundTaskState.SUCCEEDED, System.currentTimeMillis())
                    dao.get(taskId)?.let { TaskNotificationFactory.update(applicationContext, it) }
                    Result.success()
                }
                is TaskExecutionResult.Failure -> {
                    val currentState = dao.get(taskId)?.state
                    if (currentState == BackgroundTaskState.PAUSED || currentState == BackgroundTaskState.CANCELLED) {
                        return Result.success()
                    }
                    if (executionResult.shouldRetry) {
                        dao.updateState(taskId, BackgroundTaskState.QUEUED, System.currentTimeMillis())
                        Result.retry()
                    } else {
                        dao.updateState(taskId, BackgroundTaskState.FAILED, System.currentTimeMillis())
                        dao.get(taskId)?.let { TaskNotificationFactory.update(applicationContext, it) }
                        // A logical task failure must not cancel the rest of WorkManager's chain.
                        Result.success()
                    }
                }
            }
        } catch (error: CancellationException) {
            val latestState = dao.get(taskId)?.state
            if (latestState !in listOf(BackgroundTaskState.PAUSED, BackgroundTaskState.CANCELLED)) {
                dao.updateState(taskId, BackgroundTaskState.QUEUED, System.currentTimeMillis())
            }
            throw error
        } finally {
            TaskExecutionRegistry.cancel(taskId)
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
}
