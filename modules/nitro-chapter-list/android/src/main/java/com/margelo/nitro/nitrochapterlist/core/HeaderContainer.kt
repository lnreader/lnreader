package com.margelo.nitro.nitrochapterlist.core

import android.annotation.SuppressLint
import android.content.Context
import android.view.View
import android.view.ViewGroup

/**
 * Hosts the native novel header or a React header supplied by the caller.
 * [HeaderViewHolder] moves this container into the visible header item.
 *
 * Fabric keeps measuring and laying out the child at its Yoga frame (top-left of
 * the list, full width). Native headers use RecyclerView's width and measure
 * their own height so metadata and text size changes stay in Android layout.
 */
@SuppressLint("ViewConstructor")
class HeaderContainer(context: Context) : ViewGroup(context) {
  var reactChild: View? = null
    private set
  private var nativeChild: View? = null

  /** Last measured header height, kept while the header is scrolled away. */
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
    }
    // On removal keep the last height: the header child only goes away when the
    // list unmounts, often while its screen animates out, and collapsing it
    // would shift the rows up mid-animation.
  }

  fun setNativeChild(child: View?) {
    if (nativeChild === child) return
    nativeChild?.let(::removeView)
    nativeChild = child
    if (child != null) addView(child)
    requestLayout()
  }

  private fun updateContentHeight(height: Int) {
    if (height == contentHeight) return
    contentHeight = height
    requestLayout()
    onContentHeightChanged?.invoke()
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    nativeChild?.let { child ->
      child.measure(widthMeasureSpec, MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED))
      if (contentHeight != child.measuredHeight) {
        contentHeight = child.measuredHeight
        post { onContentHeightChanged?.invoke() }
      }
    }
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), contentHeight)
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    nativeChild?.let { it.layout(0, 0, it.measuredWidth, it.measuredHeight) }
    // Fabric owns the child's frame.
  }

  override fun generateDefaultLayoutParams(): LayoutParams =
    LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
}
