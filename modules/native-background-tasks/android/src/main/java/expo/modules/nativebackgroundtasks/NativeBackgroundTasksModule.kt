package expo.modules.nativebackgroundtasks

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import java.lang.ref.WeakReference
import java.util.UUID

class NativeBackgroundTasksModule : Module() {
    private val dao by lazy {
        BackgroundTaskDatabase.get(appContext.reactContext!!).tasks()
    }

    override fun definition() = ModuleDefinition {
        Name("NativeBackgroundTasks")

        OnCreate {
            appContext.reactContext?.let { reactContextRef = WeakReference(it as ReactApplicationContext) }
        }

        OnDestroy {
            reactContextRef?.clear()
            reactContextRef = null
        }

        AsyncFunction("enqueue") { type: String, payload: String, title: String, description: String, allowsDuplicates: Boolean ->
            runBlocking(Dispatchers.IO) {
                if (!allowsDuplicates) {
                    dao.getActiveByType(type)?.let { return@runBlocking it.id }
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
                BackgroundTaskScheduler.enqueue(appContext.reactContext!!, task.id)
                task.id
            }
        }

        AsyncFunction("getTasks") {
            runBlocking(Dispatchers.IO) {
                val result = mutableListOf<Map<String, Any?>>()
                dao.getAll().forEach { task ->
                    result.add(mapOf(
                        "id" to task.id,
                        "type" to task.type,
                        "payload" to task.payload,
                        "title" to task.title,
                        "description" to task.description,
                        "state" to task.state,
                        "progress" to task.progress,
                        "progressText" to task.progressText,
                        "checkpoint" to task.checkpoint,
                        "attempt" to task.attempt,
                        "createdAt" to task.createdAt.toDouble(),
                        "updatedAt" to task.updatedAt.toDouble(),
                    ))
                }
                result
            }
        }

        AsyncFunction("pause") { taskId: String ->
            runBlocking(Dispatchers.IO) {
                requireTask(taskId)
                dao.updateState(taskId, BackgroundTaskState.PAUSED, System.currentTimeMillis())
                if (TaskExecutionRegistry.isActive(taskId)) {
                    emitInterruption(taskId, "pause")
                }
                dao.get(taskId)?.let { TaskNotificationFactory.update(appContext.reactContext!!, it) }
            }
        }

        AsyncFunction("resume") { taskId: String ->
            runBlocking(Dispatchers.IO) {
                requireTask(taskId)
                if (TaskExecutionRegistry.isActive(taskId)) {
                    throw IllegalStateException("Task is still pausing; try resuming again shortly")
                }
                dao.updateState(taskId, BackgroundTaskState.QUEUED, System.currentTimeMillis())
                BackgroundTaskScheduler.enqueue(appContext.reactContext!!, taskId)
            }
        }

        AsyncFunction("cancel") { taskId: String ->
            runBlocking(Dispatchers.IO) {
                requireTask(taskId)
                dao.updateState(taskId, BackgroundTaskState.CANCELLED, System.currentTimeMillis())
                if (TaskExecutionRegistry.isActive(taskId)) {
                    emitInterruption(taskId, "cancel")
                }
                dao.updateCheckpoint(taskId, null, System.currentTimeMillis())
                TaskNotificationFactory.dismiss(appContext.reactContext!!, taskId)
            }
        }

        AsyncFunction("updateProgress") { taskId: String, progress: Double, progressText: String ->
            runBlocking(Dispatchers.IO) {
                dao.updateProgress(
                    taskId,
                    progress.takeUnless { it < 0 },
                    progressText.ifEmpty { null },
                    System.currentTimeMillis(),
                )
                dao.get(taskId)?.let { TaskNotificationFactory.update(appContext.reactContext!!, it) }
            }
        }

        AsyncFunction("updateCheckpoint") { taskId: String, checkpoint: String ->
            runBlocking(Dispatchers.IO) {
                requireTask(taskId)
                dao.updateCheckpoint(taskId, checkpoint, System.currentTimeMillis())
            }
        }

        AsyncFunction("complete") { taskId: String ->
            runBlocking(Dispatchers.IO) {
                dao.updateCheckpoint(taskId, null, System.currentTimeMillis())
                dao.finishRunning(taskId, BackgroundTaskState.SUCCEEDED, System.currentTimeMillis())
                TaskExecutionRegistry.complete(taskId, TaskExecutionResult.Success)
            }
        }

        AsyncFunction("fail") { taskId: String, error: String, shouldRetry: Boolean ->
            runBlocking(Dispatchers.IO) {
                dao.updateProgress(taskId, null, error, System.currentTimeMillis())
                dao.finishRunning(
                    taskId,
                    if (shouldRetry) BackgroundTaskState.QUEUED else BackgroundTaskState.FAILED,
                    System.currentTimeMillis(),
                )
                TaskExecutionRegistry.complete(taskId, TaskExecutionResult.Failure(error, shouldRetry))
            }
        }
    }

    private suspend fun requireTask(taskId: String): BackgroundTaskEntity =
        dao.get(taskId) ?: throw IllegalArgumentException("Unknown background task: $taskId")

    companion object {
        @Volatile
        private var reactContextRef: WeakReference<ReactApplicationContext>? = null

        fun emitInterruption(taskId: String, action: String) {
            reactContextRef?.get()?.let { ctx ->
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("LNReaderTaskInterrupted", Arguments.createMap().apply {
                        putString("taskId", taskId)
                        putString("action", action)
                    })
            }
        }
    }
}