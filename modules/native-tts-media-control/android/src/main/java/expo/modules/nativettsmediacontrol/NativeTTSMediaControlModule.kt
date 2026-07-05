package expo.modules.nativettsmediacontrol

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.URL

class NativeTTSMediaControlModule : Module() {
    companion object {
        private const val CHANNEL_ID = "tts-media-controls"
        private const val NOTIFICATION_ID = 1001
        private const val ACTION_PLAY = "com.lnreader.TTS_PLAY"
        private const val ACTION_PAUSE = "com.lnreader.TTS_PAUSE"
        private const val ACTION_STOP = "com.lnreader.TTS_STOP"
        private const val ACTION_PREV = "com.lnreader.TTS_PREV"
        private const val ACTION_NEXT = "com.lnreader.TTS_NEXT"
        private const val ACTION_REWIND = "com.lnreader.TTS_REWIND"
    }

    private var mediaSession: MediaSessionCompat? = null
    private var isPlaying = false
    private var coverBitmap: Bitmap? = null
    private var currentCoverUri: String? = null
    private var currentTitle: String? = null
    private var currentSubtitle: String? = null
    private var receiverRegistered = false
    private var currentPosition: Long = 0L
    private var totalDuration: Long = 0L

    private val mediaReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                ACTION_PLAY -> {
                    isPlaying = true
                    this@NativeTTSMediaControlModule.sendEvent("TTSPlay", mapOf())
                    updateNotification()
                }

                ACTION_PAUSE -> {
                    isPlaying = false
                    this@NativeTTSMediaControlModule.sendEvent("TTSPause", mapOf())
                    updateNotification()
                }

                ACTION_STOP -> this@NativeTTSMediaControlModule.sendEvent("TTSStop", mapOf())
                ACTION_PREV -> this@NativeTTSMediaControlModule.sendEvent("TTSPrev", mapOf())
                ACTION_NEXT -> this@NativeTTSMediaControlModule.sendEvent("TTSNext", mapOf())
                ACTION_REWIND -> this@NativeTTSMediaControlModule.sendEvent("TTSRewind", mapOf())
            }
        }
    }

    private fun ensureChannel() {
        val reactContext = appContext.reactContext ?: return
        val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "TTS Media Controls",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Text-to-speech playback controls"
                setShowBadge(false)
            }
            manager.createNotificationChannel(channel)
        }
    }

    private fun ensureMediaSession() {
        val reactContext = appContext.reactContext ?: return
        if (mediaSession == null) {
            mediaSession = MediaSessionCompat(reactContext, "LNReaderTTS").apply {
                setCallback(object : MediaSessionCompat.Callback() {
                    override fun onPlay() {
                        isPlaying = true
                        this@NativeTTSMediaControlModule.sendEvent("TTSPlay", mapOf())
                        updateNotification()
                    }

                    override fun onPause() {
                        isPlaying = false
                        this@NativeTTSMediaControlModule.sendEvent("TTSPause", mapOf())
                        updateNotification()
                    }

                    override fun onStop() {
                        this@NativeTTSMediaControlModule.sendEvent("TTSStop", mapOf())
                    }

                    override fun onSkipToPrevious() {
                        this@NativeTTSMediaControlModule.sendEvent("TTSPrev", mapOf())
                    }

                    override fun onSkipToNext() {
                        this@NativeTTSMediaControlModule.sendEvent("TTSNext", mapOf())
                    }

                    override fun onSeekTo(pos: Long) {
                        val elementIndex = pos / 1000L
                        currentPosition = elementIndex
                        updateNotification()
                        this@NativeTTSMediaControlModule.sendEvent(
                            "TTSSeekTo",
                            mapOf("position" to elementIndex.toInt())
                        )
                    }
                })
                isActive = true
            }
        }
    }

    private fun registerReceiver() {
        val reactContext = appContext.reactContext ?: return
        if (!receiverRegistered) {
            val filter = IntentFilter().apply {
                addAction(ACTION_PLAY)
                addAction(ACTION_PAUSE)
                addAction(ACTION_STOP)
                addAction(ACTION_PREV)
                addAction(ACTION_NEXT)
                addAction(ACTION_REWIND)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactContext.registerReceiver(mediaReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                reactContext.registerReceiver(mediaReceiver, filter)
            }
            receiverRegistered = true
        }
    }

    private fun buildPendingIntent(action: String): PendingIntent {
        val reactContext = appContext.reactContext ?: throw Exception("No react context")
        val intent = Intent(action).setPackage(reactContext.packageName)
        return PendingIntent.getBroadcast(
            reactContext,
            action.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun getContentIntent(): PendingIntent {
        val reactContext = appContext.reactContext ?: throw Exception("No react context")
        val intent = reactContext.packageManager.getLaunchIntentForPackage(reactContext.packageName)
            ?: Intent()
        return PendingIntent.getActivity(
            reactContext,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun updateNotification() {
        val reactContext = appContext.reactContext ?: return
        val session = mediaSession ?: return

        val stateBuilder = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                        PlaybackStateCompat.ACTION_STOP or
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                        PlaybackStateCompat.ACTION_SEEK_TO
            )
            .setState(
                if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
                currentPosition * 1000L,
                0f
            )
        session.setPlaybackState(stateBuilder.build())

        val metadataBuilder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentSubtitle ?: "")
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentTitle ?: "")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, totalDuration * 1000L)
        coverBitmap?.let {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it)
        }
        session.setMetadata(metadataBuilder.build())

        val playPauseAction = if (isPlaying) {
            NotificationCompat.Action.Builder(
                android.R.drawable.ic_media_pause,
                "Pause",
                buildPendingIntent(ACTION_PAUSE)
            ).build()
        } else {
            NotificationCompat.Action.Builder(
                android.R.drawable.ic_media_play,
                "Play",
                buildPendingIntent(ACTION_PLAY)
            ).build()
        }

        val prevAction = NotificationCompat.Action.Builder(
            android.R.drawable.ic_media_previous,
            "Previous",
            buildPendingIntent(ACTION_PREV)
        ).build()

        val rewindAction = NotificationCompat.Action.Builder(
            android.R.drawable.ic_media_rew,
            "Replay",
            buildPendingIntent(ACTION_REWIND)
        ).build()

        val nextAction = NotificationCompat.Action.Builder(
            android.R.drawable.ic_media_next,
            "Next",
            buildPendingIntent(ACTION_NEXT)
        ).build()

        val notification = NotificationCompat.Builder(reactContext, CHANNEL_ID)
            .setContentTitle(currentSubtitle)
            .setContentText(currentTitle)
            .setSmallIcon(reactContext.applicationInfo.icon)
            .setLargeIcon(coverBitmap)
            .setContentIntent(getContentIntent())
            .setDeleteIntent(buildPendingIntent(ACTION_STOP))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .addAction(prevAction)
            .addAction(rewindAction)
            .addAction(playPauseAction)
            .addAction(nextAction)
            .setStyle(
                MediaStyle()
                    .setMediaSession(session.sessionToken)
                    .setShowActionsInCompactView(1, 2, 3)
            )
            .build()

        val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun loadCoverBitmap(coverUri: String) {
        if (coverUri == currentCoverUri && coverBitmap != null) return
        currentCoverUri = coverUri

        if (coverUri.isBlank()) {
            coverBitmap = null
            return
        }

        if (coverUri.startsWith("file://")) {
            val path = coverUri.removePrefix("file://").split("?")[0]
            val file = File(path)
            if (file.exists()) {
                coverBitmap = BitmapFactory.decodeFile(file.absolutePath)
            }
        } else if (coverUri.startsWith("http")) {
            coverBitmap = null
            Thread {
                try {
                    val stream = URL(coverUri).openStream()
                    val bitmap = BitmapFactory.decodeStream(stream)
                    stream.close()
                    coverBitmap = bitmap
                    updateNotification()
                } catch (_: Exception) {
                    // Silently fail — notification will show without cover
                }
            }.start()
        }
    }

    override fun definition() = ModuleDefinition {
        Name("NativeTTSMediaControl")

        Events(
            "TTSPlay",
            "TTSPause",
            "TTSStop",
            "TTSPrev",
            "TTSNext",
            "TTSRewind",
            "TTSSeekTo"
        )

        Function("showMediaNotification") { title: String, subtitle: String, coverUri: String, playing: Boolean ->
            isPlaying = playing
            currentTitle = title
            currentSubtitle = subtitle

            ensureChannel()
            ensureMediaSession()
            registerReceiver()
            loadCoverBitmap(coverUri)
            updateNotification()
        }

        Function("updatePlaybackState") { playing: Boolean ->
            isPlaying = playing
            updateNotification()
        }

        Function("updateProgress") { current: Double, total: Double ->
            currentPosition = current.toLong()
            totalDuration = total.toLong()
            updateNotification()
        }

        Function("dismiss") {
            mediaSession?.isActive = false
            mediaSession?.release()
            mediaSession = null

            val reactContext = appContext.reactContext
            if (reactContext != null) {
                val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.cancel(NOTIFICATION_ID)

                if (receiverRegistered) {
                    try {
                        reactContext.unregisterReceiver(mediaReceiver)
                    } catch (_: Exception) {
                    }
                    receiverRegistered = false
                }
            }

            coverBitmap = null
            currentCoverUri = null
            currentPosition = 0L
            totalDuration = 0L
        }
        OnDestroy {
            mediaSession?.release()
            mediaSession = null
            val reactContext = appContext.reactContext
            if (reactContext != null && receiverRegistered) {
                try {
                    reactContext.unregisterReceiver(mediaReceiver)
                } catch (_: Exception) {
                }
                receiverRegistered = false
            }
        }
    }
}
