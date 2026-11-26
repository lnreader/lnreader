package expo.modules.nativebackgroundtasks

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class TaskActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra(TaskNotificationFactory.EXTRA_TASK_ID) ?: return
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val dao = BackgroundTaskDatabase.get(context).tasks()
                val task = dao.get(taskId) ?: return@launch
                when (intent.action) {
                    TaskNotificationFactory.ACTION_PAUSE -> {
                        if (dao.markPaused(taskId, System.currentTimeMillis()) > 0) {
                            if (TaskExecutionRegistry.isActive(taskId)) {
                                NativeBackgroundTasksModule.emitInterruption(taskId, "pause")
                            }
                            dao.get(taskId)?.let { TaskNotificationFactory.update(context, it) }
                        }
                    }
                    TaskNotificationFactory.ACTION_RESUME -> {
                        if (TaskExecutionRegistry.isActive(taskId)) return@launch
                        if (dao.markQueued(taskId, System.currentTimeMillis()) > 0) {
                            BackgroundTaskScheduler.enqueue(context, taskId)
                        }
                    }
                    TaskNotificationFactory.ACTION_CANCEL -> {
                        val isRunning = task.state == BackgroundTaskState.RUNNING ||
                            TaskExecutionRegistry.isActive(taskId)
                        if (dao.markCancelled(taskId, System.currentTimeMillis()) == 0) {
                            TaskNotificationFactory.dismiss(context, taskId)
                            return@launch
                        }
                        if (isRunning) {
                            NativeBackgroundTasksModule.emitInterruption(taskId, "cancel")
                        }
                        BackgroundTaskScheduler.cancel(context, taskId, isRunning)
                        TaskNotificationFactory.dismiss(context, taskId)
                        if (!isRunning && task.state != BackgroundTaskState.QUEUED) {
                            dao.deleteIfState(taskId, BackgroundTaskState.CANCELLED)
                        }
                    }
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
