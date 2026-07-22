package com.rajarsheechatterjee.background

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [BackgroundTaskEntity::class], version = 1, exportSchema = false)
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
                ).build().also { instance = it }
            }
    }
}
