package com.margelo.nitro.nitrochapterlist.core

import android.view.View
import com.facebook.react.uimanager.ViewGroupManager

/**
 * Child handling shared by list hosts: the single React child (the header) is
 * placed in the RecyclerView's header item instead of being added to the view
 * itself, the way react-native-pager-view hosts its pages.
 */
abstract class ListHostViewManager<T : ListHostView> : ViewGroupManager<T>() {
  override fun addView(parent: T, child: View, index: Int) {
    parent.setHeaderChild(child)
  }

  override fun getChildCount(parent: T): Int = if (parent.header.reactChild != null) 1 else 0

  override fun getChildAt(parent: T, index: Int): View? = if (index == 0) parent.header.reactChild else null

  override fun removeViewAt(parent: T, index: Int) {
    if (index == 0) parent.setHeaderChild(null)
  }

  override fun removeView(parent: T, view: View) {
    if (parent.header.reactChild === view) parent.setHeaderChild(null)
  }

  override fun removeAllViews(parent: T) {
    parent.setHeaderChild(null)
  }

  // Fabric keeps laying the header child out at its Yoga frame.
  override fun needsCustomLayoutForChildren(): Boolean = false

  /** Direct events of the host plus [extra] (event name to JS prop). */
  protected fun directEventTypes(extra: Map<String, String>): MutableMap<String, Any> {
    val constants = HashMap<String, Any>()
    (ListEvent.registrationNames + extra).forEach { (event, registrationName) ->
      constants[event] = mapOf("registrationName" to registrationName)
    }
    return constants
  }
}
