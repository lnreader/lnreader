package com.margelo.nitro.nitrotts

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise

@Keep
@DoNotStrip
final class HybridTtsSession : HybridTtsSessionSpec() {
    override fun load(
        paragraphs: Array<TtsParagraph>,
        initialIndex: Double,
        metadata: TtsMetadata,
        settings: TtsSettings,
    ): Promise<Unit> {
        return MainThreadPromise.run {
            TtsPlaybackStore.load(
                paragraphs,
                initialIndex.toInt(),
                metadata,
                settings,
            )
        }
    }

    override fun play(): Promise<Unit> =
        MainThreadPromise.run(TtsPlaybackStore::play)

    override fun pause(): Promise<Unit> =
        MainThreadPromise.run(TtsPlaybackStore::pause)

    override fun stop(): Promise<Unit> =
        MainThreadPromise.run(TtsPlaybackStore::stop)

    override fun skipPrevious(): Promise<Unit> =
        MainThreadPromise.run(TtsPlaybackStore::skipPrevious)

    override fun skipNext(): Promise<Unit> =
        MainThreadPromise.run(TtsPlaybackStore::skipNext)

    override fun replayCurrent(): Promise<Unit> =
        MainThreadPromise.run(TtsPlaybackStore::replayCurrent)

    override fun seekTo(index: Double): Promise<Unit> =
        MainThreadPromise.run { TtsPlaybackStore.seekTo(index.toInt()) }

    override fun updateSettings(settings: TtsSettings): Promise<Unit> =
        MainThreadPromise.run { TtsPlaybackStore.updateSettings(settings) }

    override fun addOnStateChangedListener(
        listener: (state: TtsPlaybackState) -> Unit,
    ): ListenerSubscription {
        return ListenerSubscription(TtsPlaybackStore.addStateListener(listener))
    }

    override fun addOnProgressChangedListener(
        listener: (progress: TtsProgress) -> Unit,
    ): ListenerSubscription {
        return ListenerSubscription(TtsPlaybackStore.addProgressListener(listener))
    }

    override fun addOnErrorListener(
        listener: (message: String) -> Unit,
    ): ListenerSubscription {
        return ListenerSubscription(TtsPlaybackStore.addErrorListener(listener))
    }
}
