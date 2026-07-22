package com.rajarsheechatterjee.background

import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.ConcurrentHashMap

sealed interface TaskExecutionResult {
    data object Success : TaskExecutionResult
    data class Failure(val error: String, val shouldRetry: Boolean) : TaskExecutionResult
}

object TaskExecutionRegistry {
    private val executions = ConcurrentHashMap<String, CompletableDeferred<TaskExecutionResult>>()

    fun register(taskId: String): CompletableDeferred<TaskExecutionResult> {
        val execution = CompletableDeferred<TaskExecutionResult>()
        executions.put(taskId, execution)?.cancel()
        return execution
    }

    fun complete(taskId: String, result: TaskExecutionResult) {
        executions.remove(taskId)?.complete(result)
    }

    fun cancel(taskId: String) {
        executions.remove(taskId)?.cancel()
    }

    fun isActive(taskId: String): Boolean = executions.containsKey(taskId)
}
