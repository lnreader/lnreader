package com.margelo.nitro.nitrochapterlist

import android.os.Handler
import android.os.Looper
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.nitrochapterlist.chapter.ChapterListModel
import com.margelo.nitro.nitrochapterlist.chapter.ChapterListPerf
import java.util.concurrent.atomic.AtomicInteger

/**
 * Nitro entry point for chapter row data. Methods arrive on the JS thread; each
 * call copies its input and applies it to [model] in one main-thread post, so
 * one JS call produces one batch of adapter notifications.
 */
@Keep
@DoNotStrip
class HybridChapterListStore : HybridChapterListStoreSpec() {
  override val id: String = "chapter-list-store-" + nextId.incrementAndGet()

  /** Main-thread only. */
  val model = ChapterListModel()

  private val mainHandler = Handler(Looper.getMainLooper())

  init {
    ChapterListStoreRegistry.register(this)
  }

  override fun reset(totalCount: Double) {
    val count = totalCount.toInt()
    postTimed("reset($count)") { model.reset(count) }
  }

  override fun setRows(start: Double, rows: Array<ChapterRow>) {
    val position = start.toInt()
    // Nitro hands over a fresh array; copy anyway so JS-side reuse can't race.
    val copy = rows.copyOf()
    postTimed("setRows($position, ${copy.size})") { model.setRows(position, copy) }
  }

  override fun updateRows(rows: Array<ChapterRow>) {
    val copy = rows.copyOf()
    mainHandler.post { model.updateRows(copy) }
  }

  override fun setSelected(ids: DoubleArray) {
    val copy = IntArray(ids.size) { ids[it].toInt() }
    mainHandler.post { model.setSelected(copy) }
  }

  override fun setHighlighted(id: Double?) {
    val chapterId = id?.toInt()
    mainHandler.post { model.setHighlighted(chapterId) }
  }

  override fun setDownloading(ids: DoubleArray) {
    val copy = IntArray(ids.size) { ids[it].toInt() }
    mainHandler.post { model.setDownloading(copy) }
  }

  /** Bulk changes log how long they waited for the main thread and how long they took there. */
  private fun postTimed(what: String, block: () -> Unit) {
    val postedAt = ChapterListPerf.now()
    mainHandler.post {
      ChapterListPerf.log("$what queued", postedAt)
      val startedAt = ChapterListPerf.now()
      block()
      ChapterListPerf.log("$what applied", startedAt)
    }
  }

  private companion object {
    val nextId = AtomicInteger(0)
  }
}
