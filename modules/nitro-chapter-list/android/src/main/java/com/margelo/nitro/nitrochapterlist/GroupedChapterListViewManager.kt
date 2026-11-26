package com.margelo.nitro.nitrochapterlist

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.LNGroupedChapterListViewManagerDelegate
import com.facebook.react.viewmanagers.LNGroupedChapterListViewManagerInterface
import com.margelo.nitro.nitrochapterlist.chapter.ChapterListTheme
import com.margelo.nitro.nitrochapterlist.core.ListHostViewManager
import com.margelo.nitro.nitrochapterlist.grouped.GroupedChapterListAdapter
import com.margelo.nitro.nitrochapterlist.grouped.GroupedChapterListView

@ReactModule(name = GroupedChapterListViewManager.NAME)
class GroupedChapterListViewManager :
  ListHostViewManager<GroupedChapterListView>(), LNGroupedChapterListViewManagerInterface<GroupedChapterListView> {

  private val delegate = LNGroupedChapterListViewManagerDelegate(this)
  override fun getDelegate(): ViewManagerDelegate<GroupedChapterListView> = delegate
  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext) = GroupedChapterListView(context)

  override fun onDropViewInstance(view: GroupedChapterListView) {
    view.dispose()
    super.onDropViewInstance(view)
  }

  override fun setStoreId(view: GroupedChapterListView, id: String?) = view.bindStore(id)

  override fun setColors(view: GroupedChapterListView, value: ReadableMap?) {
    if (value == null) return
    // The view's themed colors and strings are independent Fabric props.
    view.setTheme(view.theme.copy(
      onSurface = value.getInt("onSurface"),
      onSurfaceVariant = value.getInt("onSurfaceVariant"),
      outline = value.getInt("outline"),
      primary = value.getInt("primary"),
      onPrimary = value.getInt("onPrimary"),
      rippleColor = value.getInt("rippleColor"),
      surfaceVariant = value.getInt("surfaceVariant"),
    ))
  }

  override fun setStrings(view: GroupedChapterListView, value: ReadableMap?) {
    if (value == null) return
    val defaults = ChapterListTheme()
    view.setTheme(view.theme.copy(
      chapterTitleTemplate = value.getString("chapterTitleTemplate") ?: defaults.chapterTitleTemplate,
      deleteLabel = value.getString("deleteLabel") ?: defaults.deleteLabel,
      downloadA11yLabel = value.getString("downloadA11yLabel") ?: defaults.downloadA11yLabel,
      deleteA11yLabel = value.getString("deleteA11yLabel") ?: defaults.deleteA11yLabel,
      downloadingA11yLabel = value.getString("downloadingA11yLabel") ?: defaults.downloadingA11yLabel,
    ))
  }

  override fun setDownloadingIds(view: GroupedChapterListView, value: ReadableArray?) {
    val keys = buildSet {
      if (value != null) {
        for (index in 0 until value.size()) value.getString(index)?.let { add(it) }
      }
    }
    view.setDownloading(keys)
  }

  override fun setRefreshEnabled(view: GroupedChapterListView, enabled: Boolean) = view.enableRefresh(enabled)

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    directEventTypes(mapOf(
      GroupedChapterListAdapter.ROW_PRESS to "onRowPress",
      GroupedChapterListAdapter.COVER_PRESS to "onCoverPress",
      GroupedChapterListAdapter.DOWNLOAD_PRESS to "onDownloadPress",
      GroupedChapterListView.DELETE_PRESS to "onDeletePress",
    ))

  companion object {
    const val NAME = "LNGroupedChapterListView"
  }
}
