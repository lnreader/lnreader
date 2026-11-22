package com.margelo.nitro.nitrochapterlist

import android.os.Handler
import android.os.Looper
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

@Keep
@DoNotStrip
class HybridGroupedChapterListStore : HybridGroupedChapterListStoreSpec() {
  override val id = "grouped-chapter-list-${nextId.incrementAndGet()}"

  // The rows and listener are owned by the Android main thread.
  var rows: List<GroupedChapterRow> = emptyList()
    private set
  var onRowsChanged: ((List<GroupedChapterRow>) -> Unit)? = null

  init {
    stores.entries.removeAll { it.value.get() == null }
    stores[id] = WeakReference(this)
  }

  override fun setRows(rows: Array<GroupedChapterRow>) {
    val snapshot = rows.toList()
    mainHandler.post {
      this.rows = snapshot
      onRowsChanged?.invoke(snapshot)
    }
  }

  companion object {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val nextId = AtomicInteger()
    private val stores = ConcurrentHashMap<String, WeakReference<HybridGroupedChapterListStore>>()

    fun find(id: String): HybridGroupedChapterListStore? = stores[id]?.get()
  }
}
