package com.margelo.nitro.nitrochapterlist

import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentHashMap

/**
 * Lets list views find a store from the `storeId` prop. Weak, so a store's
 * lifetime stays owned by JS (and by the views bound to it).
 */
object ChapterListStoreRegistry {
  private val stores = ConcurrentHashMap<String, WeakReference<HybridChapterListStore>>()

  fun register(store: HybridChapterListStore) {
    stores.entries.removeAll { it.value.get() == null }
    stores[store.id] = WeakReference(store)
  }

  fun get(id: String): HybridChapterListStore? = stores[id]?.get()
}
