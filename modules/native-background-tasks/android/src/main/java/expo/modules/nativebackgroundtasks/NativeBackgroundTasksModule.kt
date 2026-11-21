package expo.modules.nativebackgroundtasks

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import expo.modules.kotlin.functions.Coroutine
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

        AsyncFunction("enqueue") { type: String, payload: String, title: String, description: String, allowsDuplicates: Boolean, queueName: String ->
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
                    queueName = queueName,
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
                dao.deleteOldTerminal(
                    System.currentTimeMillis() - TERMINAL_TASK_RETENTION_MS,
                )
                dao.getActive().map(::toSummary)
            }
        }

        AsyncFunction("getTask") { taskId: String ->
            runBlocking(Dispatchers.IO) {
                dao.get(taskId)?.let(::toRecord)
            }
        }

        AsyncFunction("pause") { taskId: String ->
            runBlocking(Dispatchers.IO) {
                requireTask(taskId)
                if (dao.markPaused(taskId, System.currentTimeMillis()) > 0) {
                    if (TaskExecutionRegistry.isActive(taskId)) {
                        emitInterruption(taskId, "pause")
                    }
                    dao.get(taskId)?.let { TaskNotificationFactory.update(appContext.reactContext!!, it) }
                }
            }
        }

        AsyncFunction("resume") { taskId: String ->
            runBlocking(Dispatchers.IO) {
                requireTask(taskId)
                if (TaskExecutionRegistry.isActive(taskId)) {
                    throw IllegalStateException("Task is still pausing; try resuming again shortly")
                }
                if (dao.markQueued(taskId, System.currentTimeMillis()) > 0) {
                    BackgroundTaskScheduler.enqueue(appContext.reactContext!!, taskId)
                }
            }
        }

        AsyncFunction("cancel") { taskId: String ->
            runBlocking(Dispatchers.IO) {
                val task = requireTask(taskId)
                val isRunning = task.state == BackgroundTaskState.RUNNING ||
                    TaskExecutionRegistry.isActive(taskId)
                if (dao.markCancelled(taskId, System.currentTimeMillis()) == 0) {
                    TaskNotificationFactory.dismiss(appContext.reactContext!!, taskId)
                    return@runBlocking
                }
                if (isRunning) {
                    emitInterruption(taskId, "cancel")
                }
                BackgroundTaskScheduler.cancel(appContext.reactContext!!, taskId, isRunning)
                TaskNotificationFactory.dismiss(appContext.reactContext!!, taskId)
                if (!isRunning && task.state != BackgroundTaskState.QUEUED) {
                    dao.deleteIfState(taskId, BackgroundTaskState.CANCELLED)
                }
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

        AsyncFunction("postWarning") Coroutine { taskId: String, title: String, message: String ->
            val context = requireNotNull(appContext.reactContext).applicationContext
            if (dao.getState(taskId) in BackgroundTaskState.active) {
                TaskNotificationFactory.postWarning(context, taskId, title, message)
                // Cancellation can dismiss the warning between the state check and posting it.
                if (dao.getState(taskId) !in BackgroundTaskState.active) {
                    TaskNotificationFactory.dismissWarning(context, taskId)
                }
            }
        }

        AsyncFunction("complete") { taskId: String, completionText: String ->
            runBlocking(Dispatchers.IO) {
                val now = System.currentTimeMillis()
                dao.updateCheckpoint(taskId, null, now)
                dao.updateProgress(taskId, null, completionText, now)
                TaskExecutionRegistry.complete(taskId, TaskExecutionResult.Success)
            }
        }

        AsyncFunction("fail") { taskId: String, error: String, shouldRetry: Boolean ->
            runBlocking(Dispatchers.IO) {
                dao.updateProgress(taskId, null, error, System.currentTimeMillis())
                TaskExecutionRegistry.complete(taskId, TaskExecutionResult.Failure(error, shouldRetry))
            }
        }

        AsyncFunction("scheduleLibraryUpdates") { intervalHours: Long, title: String, description: String ->
            LibraryUpdateScheduler.schedule(
                appContext.reactContext!!,
                intervalHours,
                title,
                description,
            )
        }

        AsyncFunction("cancelLibraryUpdates") {
            LibraryUpdateScheduler.cancel(appContext.reactContext!!)
        }

        AsyncFunction("scheduleAutomaticBackups") { intervalHours: Long, title: String, description: String, directoryUri: String ->
            AutomaticBackupScheduler.schedule(
                appContext.reactContext!!,
                intervalHours,
                title,
                description,
                directoryUri.ifEmpty { null },
            )
        }

        AsyncFunction("cancelAutomaticBackups") {
            AutomaticBackupScheduler.cancel(appContext.reactContext!!)
        }
    }

    private suspend fun requireTask(taskId: String): BackgroundTaskEntity =
        dao.get(taskId) ?: throw IllegalArgumentException("Unknown background task: $taskId")

    private fun toSummary(task: BackgroundTaskSummary): Map<String, Any?> = mapOf(
        "id" to task.id,
        "type" to task.type,
        "title" to task.title,
        "description" to task.description,
        "state" to task.state,
        "progress" to task.progress,
        "progressText" to task.progressText,
        "attempt" to task.attempt,
        "createdAt" to task.createdAt.toDouble(),
        "updatedAt" to task.updatedAt.toDouble(),
    )

    private fun toRecord(task: BackgroundTaskEntity): Map<String, Any?> = mapOf(
        "id" to task.id,
        "type" to task.type,
        "title" to task.title,
        "description" to task.description,
        "state" to task.state,
        "progress" to task.progress,
        "progressText" to task.progressText,
        "attempt" to task.attempt,
        "createdAt" to task.createdAt.toDouble(),
        "updatedAt" to task.updatedAt.toDouble(),
        "payload" to task.payload,
        "checkpoint" to task.checkpoint,
    )

    companion object {
        private const val TERMINAL_TASK_RETENTION_MS = 24 * 60 * 60 * 1000L
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
