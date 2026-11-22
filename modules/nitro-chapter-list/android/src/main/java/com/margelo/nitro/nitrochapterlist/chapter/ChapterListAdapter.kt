package com.margelo.nitro.nitrochapterlist.chapter

import com.margelo.nitro.nitrochapterlist.ChapterRow
import com.margelo.nitro.nitrochapterlist.core.HeaderContainer
import com.margelo.nitro.nitrochapterlist.core.HeaderViewHolder

import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView

/**
 * Position 0 is the React header and positions 1..n are chapters; headerless
 * ([headerCount] 0), chapters start at 0. The item count is the full filtered
 * total, so rows that aren't loaded yet bind a placeholder and ask for their
 * batch through [Callbacks.onPlaceholderBound].
 *
 * [variant] picks the row: the Novel screen's, or the reader drawer's (name and
 * date, highlighted current chapter, no long press or download button).
 */
class ChapterListAdapter(
  private val header: HeaderContainer,
  private val callbacks: Callbacks,
) : RecyclerView.Adapter<RecyclerView.ViewHolder>(), ChapterListModel.Listener {
  interface Callbacks {
    // Positions are chapter positions (excluding the header).
    fun onChapterPress(id: Int, position: Int)
    fun onChapterLongPress(id: Int, position: Int)
    fun onDownloadPress(id: Int, position: Int)
    fun onDeleteMenuRequested(id: Int, position: Int, anchor: ChapterRowView)
    fun onPlaceholderBound(position: Int)
  }

  enum class Variant { NOVEL, DRAWER }

  var variant: Variant = Variant.NOVEL
    set(value) {
      if (field == value) return
      field = value
      notifyDataSetChanged()
    }

  /** 1 with the header item at position 0, 0 when headerless. */
  var headerCount: Int = 1
    set(value) {
      if (field == value) return
      field = value
      notifyDataSetChanged()
    }


  private inner class RowHolder(val row: ChapterRowView) : RecyclerView.ViewHolder(row) {
    // Not `position`: ViewHolder already has a final getPosition().
    private val chapterPosition: Int
      get() = bindingAdapterPosition - headerCount

    init {
      row.setOnClickListener {
        val id = idAt(bindingAdapterPosition) ?: return@setOnClickListener
        callbacks.onChapterPress(id, chapterPosition)
      }
      if (row.isLongClickable) setNovelRowListeners()
    }

    private fun setNovelRowListeners() {
      row.isHapticFeedbackEnabled = false
      row.setOnLongClickListener {
        val id = idAt(bindingAdapterPosition) ?: return@setOnLongClickListener false
        callbacks.onChapterLongPress(id, chapterPosition)
        true
      }
      row.downloadButton.setOnClickListener {
        val chapterRow = model?.rowAt(chapterPosition) ?: return@setOnClickListener
        val id = chapterRow.id.toInt()
        if (chapterRow.downloaded) {
          callbacks.onDeleteMenuRequested(id, chapterPosition, row)
        } else {
          callbacks.onDownloadPress(id, chapterPosition)
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

  /** Stops listening to the model without touching the list (the view is going away). */
  fun detachModel() {
    model?.removeListener(this)
  }

  /** Row text formatting; a new one rebinds the visible rows' text. */
  var formatter: ChapterRowFormatter = ChapterRowFormatter(ChapterRowFormat())
    set(value) {
      field = value
      notifyItemRangeChanged(headerCount, chapterCount, Payload.TEXT)
    }

  /** Rebinds the visible rows' text, e.g. so relative dates move on at midnight. */
  fun refreshText() {
    notifyItemRangeChanged(headerCount, chapterCount, Payload.TEXT)
  }

  var theme: ChapterListTheme = ChapterListTheme()
    set(value) {
      if (field == value) return
      field = value
      notifyItemRangeChanged(headerCount, chapterCount, Payload.THEME)
    }

  var isLocal: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      notifyItemRangeChanged(headerCount, chapterCount, ChapterListModel.Payload.DOWNLOADING)
    }

  init {
    setHasStableIds(true)
  }

  val chapterCount: Int
    get() = model?.count ?: 0

  private fun idAt(adapterPosition: Int): Int? {
    if (adapterPosition < headerCount) return null
    return model?.rowAt(adapterPosition - headerCount)?.id?.toInt()
  }

  override fun getItemCount(): Int = headerCount + chapterCount

  override fun getItemViewType(position: Int): Int =
    when {
      position < headerCount -> TYPE_HEADER
      variant == Variant.DRAWER -> TYPE_DRAWER_ROW
      else -> TYPE_ROW
    }

  override fun getItemId(position: Int): Long {
    if (position < headerCount) return HEADER_ID
    val row = model?.rowAt(position - headerCount)
    // Placeholders get a fixed id per position; chapter ids are positive.
    return row?.id?.toLong() ?: -(position.toLong() + 1)
  }

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
    if (viewType == TYPE_HEADER) return HeaderViewHolder(parent.context)
    return RowHolder(ChapterRowView(parent.context, drawer = viewType == TYPE_DRAWER_ROW))
  }

  override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
    if (holder is HeaderViewHolder) {
      holder.bind(header)
      return
    }
    if (holder !is RowHolder) return
    val row = holder.row
    row.applyTheme(theme)
    val model = model
    val chapter = model?.rowAt(position - headerCount)
    if (model == null || chapter == null) {
      row.bindPlaceholder()
      if (holder.itemViewType == TYPE_DRAWER_ROW) row.bindHighlighted(false)
      callbacks.onPlaceholderBound(position - headerCount)
      return
    }
    if (holder.itemViewType == TYPE_DRAWER_ROW) {
      row.bindDrawerRow(chapter, formatter)
      row.bindHighlighted(model.isHighlighted(chapter.id.toInt()))
      return
    }
    row.bindRow(chapter, formatter)
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
    val chapter = model?.rowAt(position - headerCount)
    if (model == null || chapter == null) {
      onBindViewHolder(holder, position)
      return
    }
    if (holder.itemViewType == TYPE_DRAWER_ROW) {
      bindDrawerPayloads(holder.row, model, chapter, payloads, position, holder)
      return
    }
    for (payload in payloads) {
      when (payload) {
        ChapterListModel.Payload.SELECTION -> bindSelection(holder.row, model, chapter)
        ChapterListModel.Payload.DOWNLOADING -> bindDownload(holder.row, model, chapter)
        Payload.THEME -> {
          holder.row.applyTheme(theme)
          holder.row.bindRow(chapter, formatter)
        }
        Payload.TEXT -> holder.row.bindRow(chapter, formatter)
        // Novel rows don't show a highlight.
        ChapterListModel.Payload.HIGHLIGHT -> Unit
        else -> {
          onBindViewHolder(holder, position)
          return
        }
      }
    }
  }

  private fun bindDrawerPayloads(
    row: ChapterRowView,
    model: ChapterListModel,
    chapter: ChapterRow,
    payloads: List<Any>,
    position: Int,
    holder: RecyclerView.ViewHolder,
  ) {
    for (payload in payloads) {
      when (payload) {
        ChapterListModel.Payload.HIGHLIGHT -> row.bindHighlighted(model.isHighlighted(chapter.id.toInt()))
        Payload.THEME -> {
          row.applyTheme(theme)
          row.bindDrawerRow(chapter, formatter)
          row.bindHighlighted(model.isHighlighted(chapter.id.toInt()))
        }
        Payload.TEXT -> row.bindDrawerRow(chapter, formatter)
        // Drawer rows show neither selection nor download state.
        ChapterListModel.Payload.SELECTION, ChapterListModel.Payload.DOWNLOADING -> Unit
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
    notifyItemRangeChanged(start + headerCount, count, payload)
  }

  override fun onRangeInserted(start: Int, count: Int) {
    notifyItemRangeInserted(start + headerCount, count)
  }

  private object Payload {
    val THEME = Any()
    val TEXT = Any()
  }

  companion object {
    private const val TYPE_HEADER = 0
    const val TYPE_ROW = 1
    const val TYPE_DRAWER_ROW = 2
    private const val HEADER_ID = Long.MIN_VALUE
  }
}
