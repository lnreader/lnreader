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
}
