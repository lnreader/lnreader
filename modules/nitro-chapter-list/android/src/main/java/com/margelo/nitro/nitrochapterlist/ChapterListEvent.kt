package com.margelo.nitro.nitrochapterlist

import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

/** A non-coalescing direct event with a prebuilt payload. */
class ChapterListEvent(
  surfaceId: Int,
  viewTag: Int,
  private val name: String,
  private val data: WritableMap,
) : Event<ChapterListEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = name

  override fun canCoalesce(): Boolean = false

  override fun getEventData(): WritableMap = data

  companion object {
    const val CHAPTER_PRESS = "topChapterPress"
    const val CHAPTER_LONG_PRESS = "topChapterLongPress"
    const val DOWNLOAD_PRESS = "topDownloadPress"
    const val DELETE_PRESS = "topDeletePress"
    const val REFRESH = "topRefresh"
    const val REQUEST_RANGE = "topRequestRange"
    const val SCROLL = "topScroll"

    /** Event name to the JS prop it calls, as the codegen view config declares them. */
    val registrationNames =
      mapOf(
        CHAPTER_PRESS to "onChapterPress",
        CHAPTER_LONG_PRESS to "onChapterLongPress",
        DOWNLOAD_PRESS to "onDownloadPress",
        DELETE_PRESS to "onDeletePress",
        REFRESH to "onRefresh",
        REQUEST_RANGE to "onRequestRange",
        SCROLL to "onScroll",
      )
  }
}
