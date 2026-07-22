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
                dao.get(taskId) ?: return@launch
                when (intent.action) {
                    TaskNotificationFactory.ACTION_PAUSE -> {
                        dao.updateState(taskId, BackgroundTaskState.PAUSED, System.currentTimeMillis())
                        if (TaskExecutionRegistry.isActive(taskId)) {
                            NativeBackgroundTasksModule.emitInterruption(taskId, "pause")
                        }
                        dao.get(taskId)?.let { TaskNotificationFactory.update(context, it) }
                    }
                    TaskNotificationFactory.ACTION_RESUME -> {
                        if (TaskExecutionRegistry.isActive(taskId)) return@launch
                        dao.updateState(taskId, BackgroundTaskState.QUEUED, System.currentTimeMillis())
                        BackgroundTaskScheduler.enqueue(context, taskId)
                    }
                    TaskNotificationFactory.ACTION_CANCEL -> {
                        dao.updateState(taskId, BackgroundTaskState.CANCELLED, System.currentTimeMillis())
                        if (TaskExecutionRegistry.isActive(taskId)) {
                            NativeBackgroundTasksModule.emitInterruption(taskId, "cancel")
                        }
                        TaskNotificationFactory.dismiss(context, taskId)
                    }
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}