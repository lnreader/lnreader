package com.margelo.nitro.nitrotts

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

internal class TtsListenerRegistry<Value> {
    private val nextId = AtomicLong(0L)
    private val listeners = ConcurrentHashMap<Long, (Value) -> Unit>()

    fun add(listener: (Value) -> Unit): () -> Unit {
        val id = nextId.incrementAndGet()
        listeners[id] = listener
        return { listeners.remove(id) }
    }

    fun emit(value: Value) {
        listeners.values.toList().forEach { it(value) }
    }
}
