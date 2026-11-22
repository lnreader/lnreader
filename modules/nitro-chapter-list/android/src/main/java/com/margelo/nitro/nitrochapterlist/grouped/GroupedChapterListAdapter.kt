package com.margelo.nitro.nitrochapterlist.grouped

import android.content.res.ColorStateList
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.uimanager.PixelUtil
import com.margelo.nitro.nitrochapterlist.GroupedChapterRow
import com.margelo.nitro.nitrochapterlist.GroupedChapterRowKind
import com.margelo.nitro.nitrochapterlist.chapter.ChapterListTheme
import com.margelo.nitro.nitrochapterlist.chapter.ChapterRowView
import com.margelo.nitro.nitrochapterlist.core.HeaderContainer
import com.margelo.nitro.nitrochapterlist.core.HeaderViewHolder
import kotlin.math.roundToInt

class GroupedChapterListAdapter(
  private val header: HeaderContainer,
  private val onRowsChanged: (IntArray) -> Unit,
  private val onAction: (String, String) -> Unit,
  private val onDeleteMenu: (String, ChapterRowView) -> Unit,
) : ListAdapter<GroupedChapterRow, RecyclerView.ViewHolder>(DIFF) {
  private val compactHeight = PixelUtil.toPixelFromDIP(32f).roundToInt()
  private val chapterHeight = PixelUtil.toPixelFromDIP(ChapterRowView.ROW_HEIGHT_DP).roundToInt()

  // Keep the React header outside the differ so its position does not affect row updates.
  val headerAdapter = object : RecyclerView.Adapter<HeaderViewHolder>() {
    override fun getItemCount() = 1
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = HeaderViewHolder(parent.context)
    override fun onBindViewHolder(holder: HeaderViewHolder, position: Int) = holder.bind(header)
  }

  var theme = ChapterListTheme()
    set(value) {
      if (field == value) return
      field = value
      notifyItemRangeChanged(0, itemCount)
    }

  var downloadingKeys: Set<String> = emptySet()
    set(value) {
      if (field == value) return
      field = value
      notifyItemRangeChanged(0, itemCount, DOWNLOAD_STATE)
    }

  private inner class InteractiveHolder(val row: ChapterRowView) : RecyclerView.ViewHolder(row) {
    init {
      row.setOnClickListener { current()?.let { onAction(ROW_PRESS, it.key) } }
      row.cover?.setOnClickListener { current()?.let { onAction(COVER_PRESS, it.key) } }
      row.downloadButton.setOnClickListener {
        val item = current() ?: return@setOnClickListener
        if (item.kind != GroupedChapterRowKind.CHAPTER || item.key in downloadingKeys) return@setOnClickListener
        if (item.downloaded == true) onDeleteMenu(item.key, row)
        else onAction(DOWNLOAD_PRESS, item.key)
      }
    }

    private fun current(): GroupedChapterRow? = currentList.getOrNull(bindingAdapterPosition)
  }

  private class LabelHolder(val label: TextView) : RecyclerView.ViewHolder(label)

  private class LoadingHolder(
    container: FrameLayout,
    val spinner: ProgressBar,
  ) : RecyclerView.ViewHolder(container)

  override fun getItemViewType(position: Int): Int = getItem(position).kind.ordinal

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
    val context = parent.context
    return when (GroupedChapterRowKind.entries[viewType]) {
      GroupedChapterRowKind.CHAPTER, GroupedChapterRowKind.GROUP ->
        InteractiveHolder(ChapterRowView(context, grouped = true))
      GroupedChapterRowKind.LABEL -> LabelHolder(TextView(context).apply {
        layoutParams = RecyclerView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, compactHeight)
        val inset = PixelUtil.toPixelFromDIP(16f).roundToInt()
        setPaddingRelative(inset, 0, inset, 0)
        gravity = Gravity.CENTER_VERTICAL or Gravity.START
        setSingleLine()
        ViewCompat.setAccessibilityHeading(this, true)
      })
      GroupedChapterRowKind.LOADING -> {
        val spinner = ProgressBar(context)
        val container = FrameLayout(context).apply {
          layoutParams = RecyclerView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, compactHeight)
          val size = PixelUtil.toPixelFromDIP(20f).roundToInt()
          addView(spinner, FrameLayout.LayoutParams(size, size, Gravity.CENTER))
        }
        LoadingHolder(container, spinner)
      }
    }
  }

  override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
    val item = getItem(position)
    when (holder) {
      is InteractiveHolder -> {
        val row = holder.row
        row.applyTheme(theme)
        row.cover?.bind(item.cover, item.title)
        if (item.kind == GroupedChapterRowKind.GROUP) {
          row.bindGroup(item.title, item.subtitle.orEmpty(), item.expanded == true)
        } else {
          val chapterTitle = theme.chapterTitleTemplate.replace("%{num}", item.subtitle.orEmpty())
          row.bindGroupedChapter(item.title, chapterTitle, item.unread == true, item.bookmarked == true)
          bindDownload(row, item)
        }
      }
      is LabelHolder -> {
        holder.label.text = item.title
        holder.label.setTextColor(theme.onSurface)
      }
      is LoadingHolder -> holder.spinner.indeterminateTintList = ColorStateList.valueOf(theme.primary)
    }
  }

  override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int, payloads: MutableList<Any>) {
    if (payloads.isNotEmpty() && payloads.all { it === DOWNLOAD_STATE }) {
      val item = getItem(position)
      if (holder is InteractiveHolder && item.kind == GroupedChapterRowKind.CHAPTER) {
        bindDownload(holder.row, item)
      }
    } else {
      super.onBindViewHolder(holder, position, payloads)
    }
  }

  override fun onViewRecycled(holder: RecyclerView.ViewHolder) {
    if (holder is InteractiveHolder) holder.row.cover?.recycle()
    super.onViewRecycled(holder)
  }

  override fun onCurrentListChanged(previousList: List<GroupedChapterRow>, currentList: List<GroupedChapterRow>) {
    val offsets = IntArray(currentList.size + 1)
    for ((index, item) in currentList.withIndex()) {
      val height = when (item.kind) {
        GroupedChapterRowKind.LABEL, GroupedChapterRowKind.LOADING -> compactHeight
        else -> chapterHeight
      }
      offsets[index + 1] = offsets[index] + height
    }
    onRowsChanged(offsets)
  }

  private fun bindDownload(row: ChapterRowView, item: GroupedChapterRow) {
    row.bindDownloadState(when {
      item.key in downloadingKeys -> ChapterRowView.DownloadState.DOWNLOADING
      item.downloaded == true -> ChapterRowView.DownloadState.DOWNLOADED
      else -> ChapterRowView.DownloadState.DOWNLOAD
    })
  }

  companion object {
    const val ROW_PRESS = "topRowPress"
    const val COVER_PRESS = "topCoverPress"
    const val DOWNLOAD_PRESS = "topDownloadPress"
    private val DOWNLOAD_STATE = Any()
    private val DIFF = object : DiffUtil.ItemCallback<GroupedChapterRow>() {
      override fun areItemsTheSame(old: GroupedChapterRow, new: GroupedChapterRow): Boolean = old.key == new.key
      override fun areContentsTheSame(old: GroupedChapterRow, new: GroupedChapterRow): Boolean = old == new
    }
  }
}
