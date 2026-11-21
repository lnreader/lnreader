package com.margelo.nitro.nitrochapterlist

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.LNChapterListViewManagerDelegate
import com.facebook.react.viewmanagers.LNChapterListViewManagerInterface
import com.margelo.nitro.nitrochapterlist.chapter.ChapterListEvents
import com.margelo.nitro.nitrochapterlist.chapter.ChapterListView
import com.margelo.nitro.nitrochapterlist.core.ListHostViewManager

/** Fabric manager for `LNChapterListView`; child hosting comes from [ListHostViewManager]. */
@ReactModule(name = ChapterListViewManager.NAME)
class ChapterListViewManager :
  ListHostViewManager<ChapterListView>(), LNChapterListViewManagerInterface<ChapterListView> {

  private val delegate: ViewManagerDelegate<ChapterListView> = LNChapterListViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<ChapterListView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(reactContext: ThemedReactContext): ChapterListView =
    ChapterListView(reactContext)

  override fun onDropViewInstance(view: ChapterListView) {
    view.dispose()
    super.onDropViewInstance(view)
  }

  // --- Props ---

  override fun setStoreId(view: ChapterListView, value: String?) {
    view.setStoreId(value)
  }

  override fun setColors(view: ChapterListView, value: ReadableMap?) {
    val colors = HashMap<String, Int>()
    value?.entryIterator?.forEach { (key, color) ->
      if (color is Number) colors[key] = color.toInt()
    }
    view.setColors(colors)
  }

  override fun setStrings(view: ChapterListView, value: ReadableMap?) {
    val strings = HashMap<String, String>()
    value?.keySetIterator()?.let { keys ->
      while (keys.hasNextKey()) {
        val key = keys.nextKey()
        if (value.getType(key) == ReadableType.String) value.getString(key)?.let { strings[key] = it }
      }
    }
    view.setStrings(strings)
  }

  override fun setIsLocal(view: ChapterListView, value: Boolean) {
    view.setIsLocal(value)
  }

  override fun setRefreshing(view: ChapterListView, value: Boolean) {
    view.setRefreshing(value)
  }

  override fun setRefreshOffset(view: ChapterListView, value: Float) {
    view.setRefreshOffset(value)
  }

  override fun setContentPaddingBottom(view: ChapterListView, value: Float) {
    view.setContentPaddingBottom(value)
  }

  override fun setFastScrollTopInset(view: ChapterListView, value: Float) {
    view.fastScrollTopInset = value
  }

  override fun setFastScrollBottomInset(view: ChapterListView, value: Float) {
    view.fastScrollBottomInset = value
  }

  override fun setBatchSize(view: ChapterListView, value: Int) {
    view.batchSize = value
  }

  override fun setScrollEventMaxOffset(view: ChapterListView, value: Float) {
    view.setScrollEventMaxOffset(value)
  }

  override fun setScrollEventThresholds(view: ChapterListView, value: ReadableArray?) {
    val size = value?.size() ?: 0
    view.setScrollEventThresholds(FloatArray(size) { value!!.getDouble(it).toFloat() })
  }

  // --- Commands ---

  override fun scrollToIndex(view: ChapterListView, index: Int, animated: Boolean, viewPosition: Float) {
    view.scrollToIndex(index, animated, viewPosition)
  }

  override fun scrollToOffset(view: ChapterListView, offset: Float, animated: Boolean) {
    view.scrollToOffset(offset, animated)
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    directEventTypes(ChapterListEvents.registrationNames)

  companion object {
    const val NAME = "LNChapterListView"
  }
}
