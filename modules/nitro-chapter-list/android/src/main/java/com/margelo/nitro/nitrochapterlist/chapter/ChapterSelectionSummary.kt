package com.margelo.nitro.nitrochapterlist.chapter

import com.margelo.nitro.nitrochapterlist.ChapterRow

data class ChapterSelectionSummary(
  val count: Int = 0,
  val hasDownloaded: Boolean = false,
  val hasUndownloaded: Boolean = false,
  val hasUnread: Boolean = false,
  val hasRead: Boolean = false,
  val onlyLoaded: ChapterRow? = null,
)
