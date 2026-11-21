package com.margelo.nitro.nitrotts

import android.app.ForegroundServiceStartNotAllowedException
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.content.ContextCompat

internal class TtsPlaybackService : Service() {
    private lateinit var mediaNotification: TtsMediaNotification
    private var removeSnapshotListener: (() -> Unit)? = null

    override fun onCreate() {
        super.onCreate()
        mediaNotification = TtsMediaNotification(this)
        // Promote even when nothing is loaded: a service started with startForegroundService()
        // that stops before calling startForeground() is itself a crash.
        if (!promoteToForeground() || !TtsPlaybackStore.hasQueue()) {
            stopSelf()
            return
        }
        removeSnapshotListener = TtsPlaybackStore.addSnapshotListener(
            mediaNotification::notify,
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!TtsPlaybackStore.hasQueue()) {
            stopSelf(startId)
        }
        return START_NOT_STICKY
    }

    /**
     * Returns false when Android 12+ refuses the promotion (the app was in the background and
     * not exempt), instead of letting it crash the process.
     */
    private fun promoteToForeground(): Boolean {
        val notification = mediaNotification.build(TtsPlaybackStore.snapshot())
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            true
        } catch (error: IllegalStateException) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                error is ForegroundServiceStartNotAllowedException
            ) {
                false
            } else {
                throw error
            }
        }
    }

    override fun onDestroy() {
        removeSnapshotListener?.invoke()
        removeSnapshotListener = null
        mediaNotification.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        internal const val NOTIFICATION_ID = 1001

        fun start(context: Context) {
            val intent = Intent(context, TtsPlaybackService::class.java)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, TtsPlaybackService::class.java))
        }
    }
}
