package com.margelo.nitro.nitrochapterlist.core

import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

/** A non-coalescing direct event with a prebuilt payload. */
class ListEvent(
  surfaceId: Int,
  viewTag: Int,
  private val name: String,
  private val data: WritableMap,
) : Event<ListEvent>(surfaceId, viewTag) {
  override fun getEventName(): String = name

  override fun canCoalesce(): Boolean = false

  override fun getEventData(): WritableMap = data

  companion object {
    const val SCROLL = "topScroll"
    const val REFRESH = "topRefresh"
    const val REQUEST_RANGE = "topRequestRange"

    /** Events every list host emits, mapped to their JS props. */
    val registrationNames =
      mapOf(
        SCROLL to "onScroll",
        REFRESH to "onRefresh",
        REQUEST_RANGE to "onRequestRange",
      )
  }
}
