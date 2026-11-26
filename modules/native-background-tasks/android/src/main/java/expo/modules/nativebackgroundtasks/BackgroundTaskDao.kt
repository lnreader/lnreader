package expo.modules.nativebackgroundtasks

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

data class BackgroundTaskSummary(
    val id: String,
    val type: String,
    val title: String,
    val description: String,
    val state: String,
    val progress: Double?,
    val progressText: String?,
    val attempt: Int,
    val createdAt: Long,
    val updatedAt: Long,
)

@Dao
interface BackgroundTaskDao {
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(task: BackgroundTaskEntity)

    @Query(
        "SELECT id, type, title, description, state, progress, progressText, " +
            "attempt, createdAt, updatedAt " +
            "FROM background_tasks " +
            "WHERE state IN ('queued', 'running', 'paused') ORDER BY createdAt ASC",
    )
    suspend fun getActive(): List<BackgroundTaskSummary>

    @Query(
        "DELETE FROM background_tasks " +
            "WHERE state IN ('succeeded', 'failed', 'cancelled') " +
            "AND updatedAt < :cutoff",
    )
    suspend fun deleteOldTerminal(cutoff: Long)

    @Query("DELETE FROM background_tasks WHERE id = :id AND state = :state")
    suspend fun deleteIfState(id: String, state: String): Int

    @Query("SELECT * FROM background_tasks WHERE id = :id LIMIT 1")
    suspend fun get(id: String): BackgroundTaskEntity?

    @Query("SELECT state FROM background_tasks WHERE id = :id")
    suspend fun getState(id: String): String?

    @Query("SELECT * FROM background_tasks WHERE type = :type AND state IN ('queued', 'running', 'paused') LIMIT 1")
    suspend fun getActiveByType(type: String): BackgroundTaskEntity?

    @Query("SELECT * FROM background_tasks WHERE queueName = :queueName AND state = 'queued' ORDER BY createdAt ASC")
    suspend fun getQueuedByQueueName(queueName: String): List<BackgroundTaskEntity>

    @Query(
        "UPDATE background_tasks SET state = 'paused', updatedAt = :updatedAt " +
            "WHERE id = :id AND state IN ('queued', 'running')",
    )
    suspend fun markPaused(id: String, updatedAt: Long): Int

    @Query(
        "UPDATE background_tasks SET state = 'queued', updatedAt = :updatedAt " +
            "WHERE id = :id AND state = 'paused'",
    )
    suspend fun markQueued(id: String, updatedAt: Long): Int

    @Query(
        "UPDATE background_tasks SET state = 'cancelled', updatedAt = :updatedAt " +
            "WHERE id = :id AND state IN ('queued', 'running', 'paused')",
    )
    suspend fun markCancelled(id: String, updatedAt: Long): Int

    @Query("UPDATE background_tasks SET state = :state, updatedAt = :updatedAt WHERE id = :id AND state = 'running'")
    suspend fun finishRunning(id: String, state: String, updatedAt: Long): Int

    @Query(
        "UPDATE background_tasks " +
            "SET state = :state, progress = :progress, progressText = :progressText, updatedAt = :updatedAt " +
            "WHERE id = :id AND state = 'running'",
    )
    suspend fun finishRunningWithProgress(
        id: String,
        state: String,
        progress: Double?,
        progressText: String?,
        updatedAt: Long,
    ): Int

    @Query(
        """
        UPDATE background_tasks
        SET state = :state, attempt = attempt + 1, updatedAt = :updatedAt
        WHERE id = :id
          AND state = 'queued'
          AND (
            type != 'DOWNLOAD_CHAPTER'
            OR (
              SELECT COUNT(*)
              FROM background_tasks
              WHERE type = 'DOWNLOAD_CHAPTER' AND state = 'running'
            ) < :maxConcurrentDownloads
          )
        """,
    )
    suspend fun tryMarkRunning(
        id: String,
        state: String,
        updatedAt: Long,
        maxConcurrentDownloads: Int,
    ): Int

    @Query("UPDATE background_tasks SET progress = :progress, progressText = :progressText, updatedAt = :updatedAt WHERE id = :id AND state = 'running'")
    suspend fun updateProgress(id: String, progress: Double?, progressText: String?, updatedAt: Long): Int

    @Query("UPDATE background_tasks SET checkpoint = :checkpoint, updatedAt = :updatedAt WHERE id = :id AND state = 'running'")
    suspend fun updateCheckpoint(id: String, checkpoint: String?, updatedAt: Long): Int

    @Query("UPDATE background_tasks SET workId = :workId, updatedAt = :updatedAt WHERE id = :id")
    suspend fun assignWork(id: String, workId: String, updatedAt: Long)
}
