package com.rajarsheechatterjee.background

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface BackgroundTaskDao {
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(task: BackgroundTaskEntity)

    @Query("SELECT * FROM background_tasks ORDER BY createdAt ASC")
    suspend fun getAll(): List<BackgroundTaskEntity>

    @Query("SELECT * FROM background_tasks WHERE id = :id LIMIT 1")
    suspend fun get(id: String): BackgroundTaskEntity?

    @Query("SELECT * FROM background_tasks WHERE type = :type AND state IN ('queued', 'running', 'paused') LIMIT 1")
    suspend fun getActiveByType(type: String): BackgroundTaskEntity?

    @Query("UPDATE background_tasks SET state = :state, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateState(id: String, state: String, updatedAt: Long)

    @Query("UPDATE background_tasks SET state = :state, updatedAt = :updatedAt WHERE id = :id AND state = 'running'")
    suspend fun finishRunning(id: String, state: String, updatedAt: Long)

    @Query("UPDATE background_tasks SET state = :state, attempt = attempt + 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun markRunning(id: String, state: String, updatedAt: Long)

    @Query("UPDATE background_tasks SET progress = :progress, progressText = :progressText, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateProgress(id: String, progress: Double?, progressText: String?, updatedAt: Long)

    @Query("UPDATE background_tasks SET workId = :workId, updatedAt = :updatedAt WHERE id = :id")
    suspend fun assignWork(id: String, workId: String, updatedAt: Long)
}
