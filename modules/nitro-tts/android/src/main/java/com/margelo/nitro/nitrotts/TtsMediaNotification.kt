package com.margelo.nitro.nitrotts

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle

internal class TtsMediaNotification(
    private val context: Context,
) {
    private val manager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val mediaSession = MediaSessionCompat(context, "LNReaderTTS")

    init {
        ensureChannel()
        mediaSession.setCallback(TtsMediaSessionCallback())
        mediaSession.isActive = true
    }

    fun build(snapshot: TtsPlaybackSnapshot): Notification {
        updateMediaSession(snapshot)

        val isPlaying = snapshot.state == TtsPlaybackState.PLAYING
        val progressLabel = paragraphProgressLabel(snapshot.progress)
        val timerLabel = sleepTimerLabel(snapshot.sleepTimer)
        val playPauseAction = if (isPlaying) {
            action(
                android.R.drawable.ic_media_pause,
                "Pause",
                TtsPlaybackService.ACTION_PAUSE,
            )
        } else {
            action(
                android.R.drawable.ic_media_play,
                "Play",
                TtsPlaybackService.ACTION_PLAY,
            )
        }

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(snapshot.metadata?.chapterName ?: "Text to speech")
            .setContentText(
                listOfNotNull(progressLabel, timerLabel).joinToString(" · ")
                    .ifBlank { snapshot.metadata?.novelName ?: "LNReader" },
            )
            .setSubText(snapshot.metadata?.novelName)
            .setSmallIcon(context.applicationInfo.icon)
            .setContentIntent(contentIntent())
            .setDeleteIntent(serviceIntent(TtsPlaybackService.ACTION_STOP))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(isPlaying)
            .addAction(
                action(
                    android.R.drawable.ic_media_previous,
                    "Previous paragraph",
                    TtsPlaybackService.ACTION_PREVIOUS,
                ),
            )
            .addAction(playPauseAction)
            .addAction(
                action(
                    android.R.drawable.ic_media_next,
                    "Next paragraph",
                    TtsPlaybackService.ACTION_NEXT,
                ),
            )
            .setStyle(
                MediaStyle()
                    .setMediaSession(mediaSession.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2),
            )
            .build()
    }

    fun notify(snapshot: TtsPlaybackSnapshot) {
        manager.notify(TtsPlaybackService.NOTIFICATION_ID, build(snapshot))
    }

    fun release() {
        mediaSession.isActive = false
        mediaSession.release()
        manager.cancel(TtsPlaybackService.NOTIFICATION_ID)
    }

    private fun updateMediaSession(snapshot: TtsPlaybackSnapshot) {
        val progress = snapshot.progress
        val playbackState = when (snapshot.state) {
            TtsPlaybackState.PLAYING -> PlaybackStateCompat.STATE_PLAYING
            TtsPlaybackState.PAUSED -> PlaybackStateCompat.STATE_PAUSED
            TtsPlaybackState.ERROR -> PlaybackStateCompat.STATE_ERROR
            TtsPlaybackState.COMPLETED -> PlaybackStateCompat.STATE_STOPPED
            TtsPlaybackState.LOADING -> PlaybackStateCompat.STATE_BUFFERING
            TtsPlaybackState.IDLE -> PlaybackStateCompat.STATE_NONE
        }

        mediaSession.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY or
                        PlaybackStateCompat.ACTION_PAUSE or
                        PlaybackStateCompat.ACTION_STOP or
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT,
                )
                .setState(
                    playbackState,
                    PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN,
                    if (snapshot.state == TtsPlaybackState.PLAYING) 1f else 0f,
                )
                .build(),
        )

        mediaSession.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(
                    MediaMetadataCompat.METADATA_KEY_TITLE,
                    snapshot.metadata?.chapterName ?: "",
                )
                .putString(
                    MediaMetadataCompat.METADATA_KEY_ARTIST,
                    snapshot.metadata?.novelName ?: "",
                )
                .putString(
                    MediaMetadataCompat.METADATA_KEY_ALBUM,
                    paragraphProgressLabel(progress) ?: "",
                )
                .build(),
        )
    }

    private fun paragraphProgressLabel(progress: TtsProgress?): String? {
        val total = progress?.total?.toInt() ?: return null
        if (total <= 0) {
            return null
        }
        val current = progress.index.toInt().coerceIn(0, total - 1) + 1
        return "Paragraph $current of $total"
    }

    private fun sleepTimerLabel(timer: TtsSleepTimerState): String? {
        if (!timer.active) return null
        return when (timer.mode) {
            TtsSleepTimerMode.DURATION -> {
                val total = timer.remainingSeconds?.toInt() ?: return null
                val hours = total / 3600
                val minutes = (total % 3600) / 60
                val seconds = total % 60
                if (hours > 0) {
                    "Timer %d:%02d:%02d".format(hours, minutes, seconds)
                } else {
                    "Timer %d:%02d".format(minutes, seconds)
                }
            }
            TtsSleepTimerMode.CHAPTERS -> {
                val chapters = timer.remainingChapters?.toInt() ?: return null
                "Timer $chapters chapter${if (chapters == 1) "" else "s"}"
            }
            null -> null
        }
    }

    private fun action(icon: Int, title: String, action: String): NotificationCompat.Action {
        return NotificationCompat.Action.Builder(
            icon,
            title,
            serviceIntent(action),
        ).build()
    }

    private fun serviceIntent(action: String): PendingIntent {
        val intent = Intent(context, TtsPlaybackService::class.java).setAction(action)
        return PendingIntent.getService(
            context,
            action.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun contentIntent(): PendingIntent {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent()
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }
        val channel = NotificationChannel(
            CHANNEL_ID,
            "TTS Media Controls",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Text-to-speech playback controls"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        private const val CHANNEL_ID = "tts-media-controls"
    }
}
