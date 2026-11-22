package com.margelo.nitro.nitrochapterlist.novel

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.LinearLayout
import androidx.core.graphics.ColorUtils
import com.margelo.nitro.nitrochapterlist.chapter.ChapterListTheme
import com.margelo.nitro.nitrochapterlist.chapter.ChapterSelectionSummary

/** Viewport controls stay native and update directly from RecyclerView offsets. */
internal class NovelDetailsChrome(
  context: Context,
  private val onAction: (String) -> Unit,
  private val onScrollToTop: () -> Unit,
) : FrameLayout(context) {
  private val ui = NovelDetailsWidgets(context)
  private val toolbar = ui.row()
  private val title = ui.text(18f, 1)
  private val selection = ui.row()
  private val floating = FrameLayout(context)
  private val resume = ui.row()
  private val resumeIcon = ui.text(24f, 1)
  private val resumeLabel = ui.text(14f, 1)
  private val scrollToTop = ui.text(24f, 1)
  private var model: NovelDetailsModel? = null
  private var colors: ChapterListTheme? = null
  private var offset = 0
  private var viewport = 0
  private var toolbarBackground = Color.TRANSPARENT
  private var selectedCount = 0
  private var toolbarActions: List<NovelDetailsAction> = emptyList()
  private var selectionActions: List<NovelDetailsAction> = emptyList()

  init {
    isClickable = false
    addView(toolbar, LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.TOP))
    addView(selection, LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM))
    addView(floating, LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM))
    floating.addView(scrollToTop, LayoutParams(ui.dp(56f), ui.dp(56f), Gravity.START or Gravity.BOTTOM))
    floating.addView(resume, LayoutParams(WRAP_CONTENT, ui.dp(56f), Gravity.END or Gravity.BOTTOM).apply {
      marginEnd = ui.dp(16f)
      bottomMargin = ui.dp(16f)
    })
    resume.gravity = Gravity.CENTER
    resume.minimumWidth = ui.dp(56f)
    resumeIcon.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    resumeLabel.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    resumeLabel.typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    resume.addView(resumeIcon, LinearLayout.LayoutParams(ui.dp(24f), WRAP_CONTENT))
    resume.addView(resumeLabel, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply {
      marginStart = ui.dp(12f)
    })
    scrollToTop.setOnClickListener { onScrollToTop() }
    resume.setOnClickListener { model?.resume?.let { onAction(it.id) } }
  }

  fun bind(details: NovelDetailsModel, theme: ChapterListTheme) {
    val recolor = theme != colors
    model = details
    colors = theme
    val top = ui.dp(details.topInset)
    toolbar.setPaddingRelative(ui.dp(6f), top + ui.dp(8f), 0, ui.dp(8f))
    val bottom = ui.dp(details.bottomInset)
    floating.setPaddingRelative(0, 0, 0, bottom + ui.dp(16f))
    selection.setPaddingRelative(ui.dp(8f), ui.dp(6f), ui.dp(8f), bottom + ui.dp(6f))
    selection.setBackgroundColor(details.toolbarColor)
    if (recolor) {
      toolbarActions = emptyList()
      selectionActions = emptyList()
      selection.removeAllViews()
    }
    renderToolbar(theme)
    title.setTextColor(theme.onSurface)
    ui.icon(scrollToTop, details.scrollToTop.glyph)
    scrollToTop.contentDescription = details.scrollToTop.label
    scrollToTop.setTextColor(theme.primary)
    ui.ripple(scrollToTop, theme.rippleColor, details.toolbarColor, 16f)
    resume.setPaddingRelative(ui.dp(16f), 0, ui.dp(16f), 0)
    resumeIcon.setTextColor(theme.onPrimary)
    resumeLabel.setTextColor(theme.onPrimary)
    details.resume?.let {
      ui.icon(resumeIcon, it.glyph)
      resumeLabel.text = it.label
    }
    resume.contentDescription = details.resume?.label
    ui.ripple(resume, theme.rippleColor, theme.primary, 16f)
    updateScroll(offset, viewport)
  }

  fun updateSelection(state: ChapterSelectionSummary, theme: ChapterListTheme, isLocal: Boolean) {
    val details = model ?: return
    selectedCount = state.count
    renderToolbar(theme)
    val actions = if (selectedCount == 0) emptyList() else details.selectionActions.filter {
      when (it.id) {
        "selection-download-outline" -> !isLocal && state.hasUndownloaded
        "selection-trash-can-outline" -> !isLocal && state.hasDownloaded
        "selection-check" -> state.hasUnread
        "selection-check-outline" -> state.hasRead
        "selection-playlist-check" -> state.onlyLoaded?.unread == true
        "selection-playlist-remove" -> state.onlyLoaded?.unread == false
        else -> true
      }
    }
    if (selectionActions != actions) {
      selectionActions = actions
      selection.removeAllViews()
      actions.forEach {
        selection.addView(ui.iconButton(it, theme.onSurface, theme.rippleColor, onAction),
          LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
      }
    }
    updateScroll(offset, viewport)
  }

  private fun renderToolbar(theme: ChapterListTheme) {
    val details = model ?: return
    val actions = if (selectedCount > 0) details.selectionToolbar else details.toolbar
    if (toolbarActions == actions) return
    toolbarActions = actions
    toolbar.removeAllViews()
    actions.firstOrNull()?.let {
      toolbar.addView(ui.iconButton(it, theme.onSurface, theme.rippleColor, onAction))
    }
    toolbar.addView(title, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
    actions.drop(1).forEach {
      toolbar.addView(ui.iconButton(it, theme.onSurface, theme.rippleColor, onAction).apply {
        minWidth = ui.dp(52f)
        if (it.id == "downloads") textSize = 26f
      })
    }
  }

  fun updateScroll(offset: Int, viewport: Int) {
    this.offset = offset
    this.viewport = viewport
    val details = model ?: return
    val selectionMode = selectedCount > 0
    val fraction = ((offset - ui.dp(50f)).toFloat() / ui.dp(150f)).coerceIn(0f, 1f)
    val background = if (selectionMode) details.toolbarColor else
      ColorUtils.blendARGB(Color.TRANSPARENT, details.toolbarColor, fraction)
    if (toolbarBackground != background) {
      toolbarBackground = background
      toolbar.setBackgroundColor(background)
    }
    val selectionTitle = if (selectionMode) selectedCount.toString() else ""
    if (title.text.toString() != selectionTitle) title.text = selectionTitle
    selection.visibility = if (selectionMode && selectionActions.isNotEmpty()) VISIBLE else GONE
    floating.visibility = if (selectionMode) GONE else VISIBLE
    scrollToTop.visibility = if (viewport > 0 && offset > viewport / 2) VISIBLE else GONE
    resume.visibility = if (details.resume == null) GONE else VISIBLE
    resumeLabel.visibility = if (offset == 0 && !details.busy) VISIBLE else GONE
  }
}
