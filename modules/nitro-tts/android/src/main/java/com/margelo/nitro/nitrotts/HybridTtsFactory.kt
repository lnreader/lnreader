package com.margelo.nitro.nitrotts

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise

@Keep
@DoNotStrip
final class HybridTtsFactory : HybridTtsFactorySpec() {
    private val context
        get() = NitroModules.applicationContext
            ?: error("Nitro Modules has no Android application context.")

    override fun createSession(): Promise<HybridTtsSessionSpec> {
        val promise = Promise<HybridTtsSessionSpec>()
        TtsPlaybackStore.prepare(context) { result ->
            result.fold(
                onSuccess = { promise.resolve(HybridTtsSession()) },
                onFailure = { promise.reject(it) },
            )
        }
        return promise
    }

    override fun getEngines(): Promise<Array<TtsEngine>> {
        val promise = Promise<Array<TtsEngine>>()
        promise.resolve(TtsPlaybackStore.listEngines(context).toTypedArray())
        return promise
    }

    override fun getVoices(engineName: String?): Promise<Array<TtsVoice>> {
        val promise = Promise<Array<TtsVoice>>()
        TtsPlaybackStore.listVoices(context, engineName) { result ->
            result.fold(
                onSuccess = { promise.resolve(it.toTypedArray()) },
                onFailure = { promise.reject(it) },
            )
        }
        return promise
    }
}
