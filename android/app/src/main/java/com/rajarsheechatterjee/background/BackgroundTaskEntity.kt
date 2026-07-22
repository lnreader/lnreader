package com.rajarsheechatterjee.background

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "background_tasks")
data class BackgroundTaskEntity(
    @PrimaryKey val id: String,
    val type: String,
    val payload: String,
    val title: String,
    val description: String,
    val state: String,
    val progress: Double?,
    val progressText: String?,
    val checkpoint: String?,
    val attempt: Int,
    val workId: String?,
    val createdAt: Long,
    val updatedAt: Long,
)

object BackgroundTaskState {
    const val QUEUED = "queued"
    const val RUNNING = "running"
    const val PAUSED = "paused"
    const val SUCCEEDED = "succeeded"
    const val FAILED = "failed"
    const val CANCELLED = "cancelled"

    val active = listOf(QUEUED, RUNNING, PAUSED)
}
