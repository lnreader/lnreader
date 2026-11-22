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
import com.margelo.nitro.nitrochapterlist.chapter.ChapterRowFormat
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

  // Props within one update arrive in no particular order; the initial
  // position depends on the variant (header or not), so it waits for all of them.
  override fun onAfterUpdateTransaction(view: ChapterListView) {
    super.onAfterUpdateTransaction(view)
    view.onPropsApplied()
  }

  // --- Props ---

  override fun setStoreId(view: ChapterListView, value: String?) {
    view.setStoreId(value)
  }

  override fun setNovelDetails(view: ChapterListView, value: String?) {
    view.setNovelDetails(value)
  }

  override fun setJumpResult(view: ChapterListView, value: String?) {
    view.setJumpResult(value)
  }

  override fun setSelectionResult(view: ChapterListView, value: ReadableMap?) {
    val ids = value?.getArray("ids") ?: return
    view.setSelectionResult(value.getInt("requestId"), IntArray(ids.size(), ids::getInt))
  }

  override fun setVariant(view: ChapterListView, value: String?) {
    view.setVariant(value)
  }

  override fun setInitialPosition(view: ChapterListView, value: Int) {
    view.setInitialPosition(value)
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

  override fun setRowFormat(view: ChapterListView, value: ReadableMap?) {
    if (value == null) return
    val defaults = ChapterRowFormat()
    fun string(key: String, fallback: String) =
      if (value.hasKey(key) && value.getType(key) == ReadableType.String) value.getString(key) ?: fallback else fallback
    fun bool(key: String, fallback: Boolean) =
      if (value.hasKey(key) && value.getType(key) == ReadableType.Boolean) value.getBoolean(key) else fallback
    fun strings(key: String): List<String> {
      if (!value.hasKey(key) || value.getType(key) != ReadableType.Array) return emptyList()
      val array = value.getArray(key) ?: return emptyList()
      return List(array.size()) { array.getString(it) ?: "" }
    }
    view.setRowFormat(
      ChapterRowFormat(
        showChapterTitles = bool("showChapterTitles", defaults.showChapterTitles),
        chapterTitleTemplate = string("chapterTitleTemplate", defaults.chapterTitleTemplate),
        progressTemplate = string("progressTemplate", defaults.progressTemplate),
        dateFormat = string("dateFormat", defaults.dateFormat),
        relativeDates = bool("relativeDates", defaults.relativeDates),
        locale = string("locale", defaults.locale),
        sameDay = string("sameDay", defaults.sameDay),
        lastDay = string("lastDay", defaults.lastDay),
        nextDay = string("nextDay", defaults.nextDay),
        lastWeek = strings("lastWeek"),
        nextWeek = strings("nextWeek"),
        monthsShort = strings("monthsShort"),
      ),
    )
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

  override fun setContentPaddingTop(view: ChapterListView, value: Float) {
    view.setContentPaddingTop(value)
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
