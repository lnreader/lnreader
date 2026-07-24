package com.margelo.nitro.nitrotts

import android.support.v4.media.session.MediaSessionCompat

internal class TtsMediaSessionCallback : MediaSessionCompat.Callback() {
    override fun onPlay() {
        TtsPlaybackStore.play()
    }

    override fun onPause() {
        TtsPlaybackStore.pause()
    }

    override fun onStop() {
        TtsPlaybackStore.stop()
    }

    override fun onSkipToPrevious() {
        TtsPlaybackStore.skipPrevious()
    }

    override fun onSkipToNext() {
        TtsPlaybackStore.skipNext()
    }

    override fun onSeekTo(pos: Long) {
        TtsPlaybackStore.seekTo((pos / 1_000L).toInt())
    }
}
