package com.margelo.nitro.nitrochapterlist

import android.view.View
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.LNChapterListViewManagerDelegate
import com.facebook.react.viewmanagers.LNChapterListViewManagerInterface

/**
 * Fabric manager for `LNChapterListView`. Its single React child (the novel
 * header) is placed in the RecyclerView's header item instead of being added to
 * the view itself, the way react-native-pager-view hosts pages.
 */
@ReactModule(name = ChapterListViewManager.NAME)
class ChapterListViewManager :
  ViewGroupManager<ChapterListView>(), LNChapterListViewManagerInterface<ChapterListView> {

  private val delegate: ViewManagerDelegate<ChapterListView> = LNChapterListViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<ChapterListView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(reactContext: ThemedReactContext): ChapterListView =
    ChapterListView(reactContext)

  override fun onDropViewInstance(view: ChapterListView) {
    view.dispose()
    super.onDropViewInstance(view)
  }

  // --- React children ---

  override fun addView(parent: ChapterListView, child: View, index: Int) {
    parent.setHeaderChild(child)
  }

  override fun getChildCount(parent: ChapterListView): Int = if (parent.header.reactChild != null) 1 else 0

  override fun getChildAt(parent: ChapterListView, index: Int): View? =
    if (index == 0) parent.header.reactChild else null

  override fun removeViewAt(parent: ChapterListView, index: Int) {
    if (index == 0) parent.setHeaderChild(null)
  }

  override fun removeView(parent: ChapterListView, view: View) {
    if (parent.header.reactChild === view) parent.setHeaderChild(null)
  }

  override fun removeAllViews(parent: ChapterListView) {
    parent.setHeaderChild(null)
  }

  // Fabric keeps laying the header child out at its Yoga frame.
  override fun needsCustomLayoutForChildren(): Boolean = false

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
    view.batchSize = value.coerceAtLeast(1)
  }

  // --- Commands ---

  override fun scrollToIndex(view: ChapterListView, index: Int, animated: Boolean, viewPosition: Float) {
    view.scrollToIndex(index, animated, viewPosition)
  }

  override fun scrollToOffset(view: ChapterListView, offset: Float, animated: Boolean) {
    view.scrollToOffset(offset, animated)
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> {
    val constants = super.getExportedCustomDirectEventTypeConstants() ?: HashMap()
    ChapterListEvent.registrationNames.forEach { (event, registrationName) ->
      constants[event] = mapOf("registrationName" to registrationName)
    }
    return constants
  }

  companion object {
    const val NAME = "LNChapterListView"
  }
}
