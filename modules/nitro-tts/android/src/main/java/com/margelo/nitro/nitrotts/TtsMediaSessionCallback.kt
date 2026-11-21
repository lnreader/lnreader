package com.margelo.nitro.nitrotts

import android.support.v4.media.session.MediaSessionCompat

internal class TtsMediaSessionCallback : MediaSessionCompat.Callback() {
    override fun onPlay() {
        TtsPlaybackStore.handleTransportControl(TtsActionReceiver.ACTION_PLAY)
    }

    override fun onPause() {
        TtsPlaybackStore.handleTransportControl(TtsActionReceiver.ACTION_PAUSE)
    }

    override fun onStop() {
        TtsPlaybackStore.handleTransportControl(TtsActionReceiver.ACTION_STOP)
    }

    override fun onSkipToPrevious() {
        TtsPlaybackStore.handleTransportControl(TtsActionReceiver.ACTION_PREVIOUS)
    }

    override fun onSkipToNext() {
        TtsPlaybackStore.handleTransportControl(TtsActionReceiver.ACTION_NEXT)
    }
}
