package com.margelo.nitro.nitrotts

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat

/**
 * Receives the media notification's buttons and dismissal. A broadcast is used instead of a
 * service PendingIntent because the notification (or SystemUI's copy of its media controls)
 * can outlive the process: a service intent would then cold-start [TtsPlaybackService], whose
 * startForeground() Android 12+ rejects for that kind of start and crashes the app.
 */
internal class TtsActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (!TtsPlaybackStore.handleTransportControl(action)) {
            // Nothing is loaded (e.g. the process was restarted for this broadcast), so the
            // control is stale: clear it rather than leaving a dead notification behind.
            NotificationManagerCompat.from(context).cancel(TtsPlaybackService.NOTIFICATION_ID)
            TtsPlaybackService.stop(context)
        }
    }

    companion object {
        internal const val ACTION_PLAY = "com.lnreader.TTS_PLAY"
        internal const val ACTION_PAUSE = "com.lnreader.TTS_PAUSE"
        internal const val ACTION_STOP = "com.lnreader.TTS_STOP"
        internal const val ACTION_PREVIOUS = "com.lnreader.TTS_PREVIOUS"
        internal const val ACTION_NEXT = "com.lnreader.TTS_NEXT"
    }
}
