package com.margelo.nitro.nitrochapterlist.core

import android.content.Context
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.recyclerview.widget.RecyclerView

/**
 * View holder for the header item. Each holder owns an empty frame, and binding
 * moves the list's single [HeaderContainer] into it, the way
 * react-native-pager-view moves pages into its ViewHolders.
 *
 * The container is never itself a holder's item view: RecyclerView can create a
 * new header holder while an old one is still waiting to be recycled (around
 * data set changes), and two holders sharing one item view crash with
 * "Scrapped or attached views may not be recycled".
 */
class HeaderViewHolder(context: Context) :
  RecyclerView.ViewHolder(
    FrameLayout(context).apply {
      layoutParams = RecyclerView.LayoutParams(MATCH_PARENT, WRAP_CONTENT)
      clipChildren = false
    },
  ) {
  private val frame = itemView as FrameLayout

  fun bind(header: HeaderContainer) {
    if (header.parent === frame) return
    (header.parent as? ViewGroup)?.removeView(header)
    frame.addView(header, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
  }

  private companion object {
    const val MATCH_PARENT = ViewGroup.LayoutParams.MATCH_PARENT
    const val WRAP_CONTENT = ViewGroup.LayoutParams.WRAP_CONTENT
  }
}
