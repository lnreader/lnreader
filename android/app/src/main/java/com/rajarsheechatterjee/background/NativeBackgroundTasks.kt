package com.rajarsheechatterjee.background

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.lnreader.spec.NativeBackgroundTasksSpec
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.UUID

class NativeBackgroundTasks(
    private val context: ReactApplicationContext,
) : NativeBackgroundTasksSpec(context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val dao by lazy { BackgroundTaskDatabase.get(context).tasks() }

    init {
        reactContext = context
    }

    override fun enqueue(
        type: String,
        payload: String,
        title: String,
        description: String,
        allowsDuplicates: Boolean,
        promise: Promise,
    ) = runPromise(promise) {
        if (!allowsDuplicates) {
            dao.getActiveByType(type)?.let {
                promise.resolve(it.id)
                return@runPromise
            }
        }
        val now = System.currentTimeMillis()
        val task = BackgroundTaskEntity(
            id = UUID.randomUUID().toString(),
            type = type,
            payload = payload,
            title = title,
            description = description,
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
        BackgroundTaskScheduler.enqueue(context, task.id)
        promise.resolve(task.id)
    }

    override fun getTasks(promise: Promise) = runPromise(promise) {
        val result = Arguments.createArray()
        dao.getAll().forEach { task ->
            result.pushMap(Arguments.createMap().apply {
                putString("id", task.id)
                putString("type", task.type)
                putString("payload", task.payload)
                putString("title", task.title)
                putString("description", task.description)
                putString("state", task.state)
                task.progress?.let { putDouble("progress", it) }
                task.progressText?.let { putString("progressText", it) }
                task.checkpoint?.let { putString("checkpoint", it) }
                putInt("attempt", task.attempt)
                putDouble("createdAt", task.createdAt.toDouble())
                putDouble("updatedAt", task.updatedAt.toDouble())
            })
        }
        promise.resolve(result)
    }

    override fun pause(taskId: String, promise: Promise) = runPromise(promise) {
        requireTask(taskId)
        dao.updateState(taskId, BackgroundTaskState.PAUSED, System.currentTimeMillis())
        if (TaskExecutionRegistry.isActive(taskId)) {
            emitInterruption(taskId, "pause")
        }
        dao.get(taskId)?.let { TaskNotificationFactory.update(context, it) }
        promise.resolve(null)
    }

    override fun resume(taskId: String, promise: Promise) = runPromise(promise) {
        requireTask(taskId)
        if (TaskExecutionRegistry.isActive(taskId)) {
            throw IllegalStateException("Task is still pausing; try resuming again shortly")
        }
        dao.updateState(taskId, BackgroundTaskState.QUEUED, System.currentTimeMillis())
        BackgroundTaskScheduler.enqueue(context, taskId)
        promise.resolve(null)
    }

    override fun cancel(taskId: String, promise: Promise) = runPromise(promise) {
        requireTask(taskId)
        dao.updateState(taskId, BackgroundTaskState.CANCELLED, System.currentTimeMillis())
        if (TaskExecutionRegistry.isActive(taskId)) {
            emitInterruption(taskId, "cancel")
        }
        TaskNotificationFactory.dismiss(context, taskId)
        promise.resolve(null)
    }

    override fun updateProgress(
        taskId: String,
        progress: Double,
        progressText: String,
        promise: Promise,
    ) = runPromise(promise) {
        dao.updateProgress(
            taskId,
            progress.takeUnless { it < 0 },
            progressText.ifEmpty { null },
            System.currentTimeMillis(),
        )
        dao.get(taskId)?.let { TaskNotificationFactory.update(context, it) }
        promise.resolve(null)
    }

    override fun complete(taskId: String, promise: Promise) = runPromise(promise) {
        dao.finishRunning(taskId, BackgroundTaskState.SUCCEEDED, System.currentTimeMillis())
        TaskExecutionRegistry.complete(taskId, TaskExecutionResult.Success)
        promise.resolve(null)
    }

    override fun fail(taskId: String, error: String, shouldRetry: Boolean, promise: Promise) =
        runPromise(promise) {
            dao.updateProgress(taskId, null, error, System.currentTimeMillis())
            dao.finishRunning(
                taskId,
                if (shouldRetry) BackgroundTaskState.QUEUED else BackgroundTaskState.FAILED,
                System.currentTimeMillis(),
            )
            TaskExecutionRegistry.complete(taskId, TaskExecutionResult.Failure(error, shouldRetry))
            promise.resolve(null)
        }

    private suspend fun requireTask(taskId: String): BackgroundTaskEntity =
        dao.get(taskId) ?: throw IllegalArgumentException("Unknown background task: $taskId")

    private fun runPromise(promise: Promise, block: suspend () -> Unit) {
        scope.launch {
            try {
                block()
            } catch (error: CancellationException) {
                promise.reject("ECANCELLED", "Background task operation cancelled", error)
            } catch (error: Exception) {
                promise.reject("EBACKGROUNDTASK", error.message, error)
            }
        }
    }

    override fun invalidate() {
        if (reactContext === context) reactContext = null
        scope.cancel()
        super.invalidate()
    }

    companion object {
        @Volatile
        private var reactContext: ReactApplicationContext? = null

        fun emitInterruption(taskId: String, action: String) {
            reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("LNReaderTaskInterrupted", Arguments.createMap().apply {
                    putString("taskId", taskId)
                    putString("action", action)
                })
        }
    }
}
