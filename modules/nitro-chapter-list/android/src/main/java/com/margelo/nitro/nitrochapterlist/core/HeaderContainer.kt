package com.margelo.nitro.nitrochapterlist.core

import android.annotation.SuppressLint
import android.content.Context
import android.view.View
import android.view.ViewGroup

/**
 * Hosts the list's React child (the novel header). [HeaderViewHolder] moves it
 * into whichever header item RecyclerView is showing.
 *
 * Fabric keeps measuring and laying out the child at its Yoga frame (top-left of
 * the list, full width). This container never re-lays the child out; it only
 * sizes itself to the child's height and asks the list to relayout when that
 * height changes.
 */
@SuppressLint("ViewConstructor")
class HeaderContainer(context: Context) : ViewGroup(context) {
  var reactChild: View? = null
    private set

  /** Last height Fabric gave the child, kept while the header is scrolled away. */
  var contentHeight: Int = 0
    private set

  /** Called when [contentHeight] changes, so scroll metrics can be re-sent. */
  var onContentHeightChanged: (() -> Unit)? = null

  private val childLayoutListener =
    OnLayoutChangeListener { _, _, top, _, bottom, _, _, _, _ -> updateContentHeight(bottom - top) }

  init {
    clipChildren = false
  }

  fun setReactChild(child: View?) {
    if (reactChild === child) return
    reactChild?.let {
      it.removeOnLayoutChangeListener(childLayoutListener)
      removeView(it)
    }
    reactChild = child
    if (child != null) {
      (child.parent as? ViewGroup)?.removeView(child)
      // addViewInLayout skips our own requestLayout; Fabric lays the child out.
      addViewInLayout(child, 0, child.layoutParams ?: generateDefaultLayoutParams(), true)
      child.addOnLayoutChangeListener(childLayoutListener)
      updateContentHeight(child.height)
    } else {
      updateContentHeight(0)
    }
  }

  private fun updateContentHeight(height: Int) {
    if (height == contentHeight) return
    contentHeight = height
    requestLayout()
    onContentHeightChanged?.invoke()
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), contentHeight)
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    // Fabric owns the child's frame.
  }

  override fun generateDefaultLayoutParams(): LayoutParams =
    LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
}
