package com.margelo.nitro.nitrochapterlist.grouped

import android.annotation.SuppressLint
import android.widget.PopupMenu
import androidx.recyclerview.widget.ConcatAdapter
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.nitrochapterlist.HybridGroupedChapterListStore
import com.margelo.nitro.nitrochapterlist.chapter.ChapterListTheme
import com.margelo.nitro.nitrochapterlist.chapter.ChapterRowView
import com.margelo.nitro.nitrochapterlist.core.ListEvent
import com.margelo.nitro.nitrochapterlist.core.ListHostView
import kotlin.math.roundToInt

@SuppressLint("ViewConstructor")
class GroupedChapterListView(context: ThemedReactContext) : ListHostView(
  context,
  PixelUtil.toPixelFromDIP(ChapterRowView.ROW_HEIGHT_DP).roundToInt(),
  emitsScrollEvents = false,
) {
  private val adapter = GroupedChapterListAdapter(
    header,
    onRowsChanged = { offsets ->
      recyclerView.rowOffsets = offsets
      onContentChanged()
    },
    onAction = ::dispatchRow,
    onDeleteMenu = ::showDeleteMenu,
  )
  private var store: HybridGroupedChapterListStore? = null
  private var deleteMenu: PopupMenu? = null

  init {
    attachAdapter(ConcatAdapter(adapter.headerAdapter, adapter))
    setRefreshEnabled(false)
    setOnRefreshListener {
      dispatch(ListEvent.REFRESH, Arguments.createMap())
      setRefreshing(false)
    }
  }

  fun bindStore(id: String?) {
    val next = id?.let(HybridGroupedChapterListStore::find)
    if (store === next) return
    store?.onRowsChanged = null
    store = next
    next?.onRowsChanged = adapter::submitList
    adapter.submitList(next?.rows.orEmpty())
  }

  val theme: ChapterListTheme get() = adapter.theme


  fun setTheme(theme: ChapterListTheme) {
    adapter.theme = theme
    setListColors(theme.primary, theme.primary, theme.onPrimary, theme.primary)
  }

  fun setDownloading(keys: Set<String>) {
    adapter.downloadingKeys = keys
  }

  fun enableRefresh(enabled: Boolean) = setRefreshEnabled(enabled)

  private fun dispatchRow(event: String, key: String) {
    dispatch(event, Arguments.createMap().apply { putString("key", key) })
  }

  private fun showDeleteMenu(key: String, row: ChapterRowView) {
    deleteMenu?.dismiss()
    deleteMenu = PopupMenu(context, row.downloadButton).apply {
      menu.add(adapter.theme.deleteLabel)
      setOnMenuItemClickListener {
        dispatchRow(DELETE_PRESS, key)
        true
      }
      setOnDismissListener { deleteMenu = null }
      show()
    }
  }

  fun dispose() {
    deleteMenu?.dismiss()
    store?.onRowsChanged = null
    store = null
  }

  companion object {
    const val DELETE_PRESS = "topDeletePress"
  }
}
