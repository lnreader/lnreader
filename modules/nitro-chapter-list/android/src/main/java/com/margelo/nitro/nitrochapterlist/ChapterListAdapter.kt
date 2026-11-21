package com.margelo.nitro.nitrochapterlist

import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView

/**
 * Position 0 is the React header; positions 1..n are chapters. The item count is
 * the full filtered total, so rows that aren't loaded yet bind a placeholder and
 * ask for their batch through [Callbacks.onPlaceholderBound].
 */
class ChapterListAdapter(
  private val header: HeaderContainer,
  private val callbacks: Callbacks,
) : RecyclerView.Adapter<RecyclerView.ViewHolder>(), ChapterListModel.Listener {
  interface Callbacks {
    fun onChapterPress(id: Int)
    fun onChapterLongPress(id: Int)
    fun onDownloadPress(id: Int)
    fun onDeleteMenuRequested(id: Int, anchor: ChapterRowView)
    fun onPlaceholderBound(position: Int)
  }

  private class HeaderHolder(view: HeaderContainer) : RecyclerView.ViewHolder(view)

  private inner class RowHolder(val row: ChapterRowView) : RecyclerView.ViewHolder(row) {
    init {
      row.setOnClickListener { idAt(bindingAdapterPosition)?.let(callbacks::onChapterPress) }
      row.setOnLongClickListener {
        val id = idAt(bindingAdapterPosition) ?: return@setOnLongClickListener false
        callbacks.onChapterLongPress(id)
        true
      }
      row.downloadButton.setOnClickListener {
        val id = idAt(bindingAdapterPosition) ?: return@setOnClickListener
        val chapterRow = model?.rowAt(bindingAdapterPosition - HEADER_COUNT) ?: return@setOnClickListener
        if (chapterRow.downloaded) {
          callbacks.onDeleteMenuRequested(id, row)
        } else {
          callbacks.onDownloadPress(id)
        }
      }
    }
  }

  var model: ChapterListModel? = null
    set(value) {
      if (field === value) return
      field?.removeListener(this)
      field = value
      value?.addListener(this)
      notifyDataSetChanged()
    }

  var theme: ChapterListTheme = ChapterListTheme()
    set(value) {
      if (field == value) return
      field = value
      notifyItemRangeChanged(HEADER_COUNT, chapterCount, Payload.THEME)
    }

  var isLocal: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      notifyItemRangeChanged(HEADER_COUNT, chapterCount, ChapterListModel.Payload.DOWNLOADING)
    }

  init {
    setHasStableIds(true)
  }

  val chapterCount: Int
    get() = model?.count ?: 0

  private fun idAt(adapterPosition: Int): Int? {
    if (adapterPosition < HEADER_COUNT) return null
    return model?.rowAt(adapterPosition - HEADER_COUNT)?.id?.toInt()
  }

  override fun getItemCount(): Int = HEADER_COUNT + chapterCount

  override fun getItemViewType(position: Int): Int = if (position == 0) TYPE_HEADER else TYPE_ROW

  override fun getItemId(position: Int): Long {
    if (position == 0) return HEADER_ID
    val row = model?.rowAt(position - HEADER_COUNT)
    // Placeholders get a fixed id per position; chapter ids are positive.
    return row?.id?.toLong() ?: -(position.toLong() + 1)
  }

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
    if (viewType == TYPE_HEADER) {
      // One header container for the list's lifetime, so the React child is
      // never moved; RecyclerView drops this holder when it scrolls away.
      (header.parent as? ViewGroup)?.removeView(header)
      return HeaderHolder(header).apply { setIsRecyclable(false) }
    }
    return RowHolder(ChapterRowView(parent.context))
  }

  override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
    if (holder !is RowHolder) return
    val row = holder.row
    row.applyTheme(theme)
    val model = model
    val chapter = model?.rowAt(position - HEADER_COUNT)
    if (model == null || chapter == null) {
      row.bindPlaceholder()
      callbacks.onPlaceholderBound(position - HEADER_COUNT)
      return
    }
    row.bindRow(chapter)
    bindSelection(row, model, chapter)
    bindDownload(row, model, chapter)
  }

  override fun onBindViewHolder(
    holder: RecyclerView.ViewHolder,
    position: Int,
    payloads: MutableList<Any>,
  ) {
    if (payloads.isEmpty() || holder !is RowHolder) {
      onBindViewHolder(holder, position)
      return
    }
    val model = model
    val chapter = model?.rowAt(position - HEADER_COUNT)
    if (model == null || chapter == null) {
      onBindViewHolder(holder, position)
      return
    }
    for (payload in payloads) {
      when (payload) {
        ChapterListModel.Payload.SELECTION -> bindSelection(holder.row, model, chapter)
        ChapterListModel.Payload.DOWNLOADING -> bindDownload(holder.row, model, chapter)
        Payload.THEME -> {
          holder.row.applyTheme(theme)
          holder.row.bindRow(chapter)
        }
        else -> {
          onBindViewHolder(holder, position)
          return
        }
      }
    }
  }

  private fun bindSelection(row: ChapterRowView, model: ChapterListModel, chapter: ChapterRow) {
    row.bindSelected(model.isSelected(chapter.id.toInt()))
  }

  private fun bindDownload(row: ChapterRowView, model: ChapterListModel, chapter: ChapterRow) {
    row.bindDownloadState(
      when {
        isLocal -> ChapterRowView.DownloadState.HIDDEN
        model.isDownloading(chapter.id.toInt()) -> ChapterRowView.DownloadState.DOWNLOADING
        chapter.downloaded -> ChapterRowView.DownloadState.DOWNLOADED
        else -> ChapterRowView.DownloadState.DOWNLOAD
      },
    )
  }

  // ChapterListModel.Listener: model positions shift by the header.

  override fun onReset() {
    notifyDataSetChanged()
  }

  override fun onRangeChanged(start: Int, count: Int, payload: Any?) {
    notifyItemRangeChanged(start + HEADER_COUNT, count, payload)
  }

  override fun onRangeInserted(start: Int, count: Int) {
    notifyItemRangeInserted(start + HEADER_COUNT, count)
  }

  private object Payload {
    val THEME = Any()
  }

  companion object {
    const val HEADER_COUNT = 1
    private const val TYPE_HEADER = 0
    private const val TYPE_ROW = 1
    private const val HEADER_ID = Long.MIN_VALUE
  }
}
