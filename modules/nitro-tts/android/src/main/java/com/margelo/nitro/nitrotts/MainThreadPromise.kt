package com.margelo.nitro.nitrotts

import android.os.Handler
import android.os.Looper
import com.margelo.nitro.core.Promise

internal object MainThreadPromise {
    private val handler = Handler(Looper.getMainLooper())

    fun run(operation: () -> Unit): Promise<Unit> {
        val promise = Promise<Unit>()
        handler.post {
            try {
                operation()
                promise.resolve(Unit)
            } catch (error: Throwable) {
                promise.reject(error)
            }
        }
        return promise
    }
}
