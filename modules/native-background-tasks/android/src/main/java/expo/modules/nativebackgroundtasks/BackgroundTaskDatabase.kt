package expo.modules.nativebackgroundtasks

import android.content.Context
import androidx.room.Database
import androidx.room.migration.Migration
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [BackgroundTaskEntity::class], version = 2, exportSchema = false)
abstract class BackgroundTaskDatabase : RoomDatabase() {
    abstract fun tasks(): BackgroundTaskDao

    companion object {
        @Volatile private var instance: BackgroundTaskDatabase? = null

        fun get(context: Context): BackgroundTaskDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    BackgroundTaskDatabase::class.java,
                    "lnreader-background-tasks.db",
                ).addMigrations(MIGRATION_1_2)
                    .build()
                    .also { instance = it }
            }

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "ALTER TABLE background_tasks ADD COLUMN queueName TEXT NOT NULL " +
                        "DEFAULT 'lnreader-background-task-queue'",
                )
            }
        }
    }
}
