package com.margelo.nitro.nitrochapterlist.novel

import android.app.Dialog
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.Layout
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.graphics.ColorUtils
import androidx.core.widget.TextViewCompat
import com.facebook.drawee.drawable.ScalingUtils
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.nitrochapterlist.chapter.ChapterListTheme

internal class NovelDetailsHeader(
  private val reactContext: ThemedReactContext,
  private val onAction: (String) -> Unit,
) : LinearLayout(reactContext) {
  private val ui = NovelDetailsWidgets(context)
  private val hero = FrameLayout(context)
  private val error = ui.text(16f)
  private val backdrop = NovelCoverView(context, ScalingUtils.ScaleType.CENTER_CROP)
  private val shade = View(context)
  private val info = ui.row()
  private val cover = NovelCoverView(context, ScalingUtils.ScaleType.CENTER_CROP)
  private val title = ui.text(20f, 4).apply {
    setOnClickListener { onAction("title") }
    setOnLongClickListener { onAction("copy-title"); true }
  }
  private val author = ui.text(14f, 1)
  private val artist = ui.text(14f, 1)
  private val source = ui.text(14f, 1)
  private val authorIcon = ui.text(14f, 1)
  private val artistIcon = ui.text(14f, 1)
  private val sourceIcon = ui.text(14f, 1)
  private val authorRow = metadataRow(author, authorIcon)
  private val artistRow = metadataRow(artist, artistIcon)
  private val sourceRow = metadataRow(source, sourceIcon)
  private val actions = ui.row()
  private val summary = ui.text(14f).apply {
    breakStrategy = Layout.BREAK_STRATEGY_HIGH_QUALITY
    TextViewCompat.setLineHeight(this, TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_SP, 20f, resources.displayMetrics,
    ).toInt())
  }
  private val summaryContainer = FrameLayout(context)
  private val summaryChevron = ui.text(24f, 1).apply {
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
  }
  private val genres = ui.row()
  private val genreScroll = HorizontalScrollView(context).apply {
    isHorizontalScrollBarEnabled = false
    clipToPadding = false
    addView(genres)
  }
  private val read = ui.row()
  private val chapters = ui.row()
  private val chapterLabel = ui.text(14f, 1)
  private val filter = ui.text(24f, 1)
  private val pages = ui.row()
  private val progress = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
    isIndeterminate = true
  }
  private var expanded = false
  private var toggledSummary = false
  private var model: NovelDetailsModel? = null
  private var existingActions: List<NovelDetailsAction> = emptyList()
  private var existingGenres: List<String> = emptyList()
  private var existingPages: List<NovelDetailsAction> = emptyList()
  private var existingRead: NovelDetailsAction? = null
  private var theme: ChapterListTheme? = null
  private var coverDialog: Dialog? = null

  init {
    orientation = VERTICAL
    error.gravity = Gravity.CENTER
    error.visibility = GONE
    addView(error, insetRow())
    hero.addView(backdrop, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
    hero.addView(shade, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
    cover.clipToOutline = true
    cover.setOnClickListener { showCover() }
    info.addView(cover, LayoutParams(ui.dp(100f), ui.dp(150f)).apply { marginEnd = ui.dp(16f) })
    info.addView(ui.column().apply {
      setPaddingRelative(0, 0, 0, ui.dp(16f))
      addView(title, metadataParams())
      addView(authorRow, metadataParams())
      addView(artistRow, metadataParams())
      addView(sourceRow, metadataParams())
    }, LayoutParams(0, WRAP_CONTENT, 1f))
    hero.addView(info, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    addView(hero, LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    addView(actions, insetRow(10))
    summaryContainer.addView(summary, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    summaryContainer.addView(summaryChevron, FrameLayout.LayoutParams(MATCH_PARENT, ui.dp(24f), Gravity.BOTTOM))
    addView(summaryContainer, insetRow(8).apply { bottomMargin = ui.dp(9f) })
    genres.setPaddingRelative(ui.dp(16f), 0, ui.dp(16f), ui.dp(4f))
    addView(genreScroll, LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    addView(read, insetRow(16).apply { bottomMargin = ui.dp(16f) })
    chapters.addView(chapterLabel, LayoutParams(0, WRAP_CONTENT, 1f))
    chapters.addView(filter, LayoutParams(ui.dp(48f), ui.dp(48f)))
    chapters.setOnClickListener { onAction("filter") }
    chapters.setPaddingRelative(0, ui.dp(9f), 0, ui.dp(9f))
    addView(chapters, insetRow().apply { marginEnd = ui.dp(14f) })
    addView(pages, insetRow().apply { bottomMargin = ui.dp(16f) })
    addView(progress, LayoutParams(MATCH_PARENT, ui.dp(3f)))
    val toggleSummary = OnClickListener {
      toggledSummary = true
      expanded = !expanded
      updateSummary()
    }
    summary.setOnClickListener(toggleSummary)
    summaryChevron.setOnClickListener(toggleSummary)
  }

  fun bind(details: NovelDetailsModel, colors: ChapterListTheme) {
    val recolor = colors != theme
    if (model?.title != details.title) toggledSummary = false
    if (!toggledSummary) expanded = details.expandedSummary
    model = details
    theme = colors
    if (details.error.isNotEmpty()) {
      for (index in 1 until childCount) getChildAt(index).visibility = GONE
      error.setPaddingRelative(0, ui.dp(details.topInset + 96), 0, ui.dp(24f))
      setText(error, details.error, colors.onSurface)
      return
    }
    error.visibility = GONE
    hero.visibility = VISIBLE
    info.setPaddingRelative(ui.dp(20f), ui.dp(details.topInset + 78), ui.dp(16f), 0)
    cover.contentDescription = details.coverLabel
    if (recolor) cover.background = ui.pill(colors.outlineVariant, 6f)
    cover.bind(details, colors.onSurfaceVariant, colors.outlineVariant)
    backdrop.visibility = if (details.hideBackdrop || details.cover.isEmpty()) GONE else VISIBLE
    shade.visibility = backdrop.visibility
    if (backdrop.visibility == VISIBLE) {
      backdrop.bind(details, colors.onSurfaceVariant, showPlaceholder = false)
      shade.background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(
        ColorUtils.setAlphaComponent(details.background, 179), details.background,
      ))
    }
    setText(title, details.title, colors.onSurface)
    bindMetadata(authorRow, author, authorIcon, details.author, details.authorGlyph, colors.onSurfaceVariant)
    bindMetadata(artistRow, artist, artistIcon, details.artist, details.artistGlyph, colors.onSurfaceVariant)
    bindMetadata(sourceRow, source, sourceIcon, details.source, details.sourceGlyph, colors.onSurfaceVariant)
    updateSummary()
    if (recolor || existingActions != details.actions) {
      renderActions(details.actions, colors)
      existingActions = details.actions
    }
    actions.visibility = if (details.actions.isEmpty()) GONE else VISIBLE
    if (recolor || existingGenres != details.genres) {
      renderGenres(details.genres, colors)
      existingGenres = details.genres
    }
    genreScroll.visibility = if (details.genres.isEmpty()) GONE else VISIBLE
    if (recolor || existingPages != details.pages) {
      renderPages(details.pages, colors)
      existingPages = details.pages
    }
    pages.visibility = if (details.pages.isEmpty()) GONE else VISIBLE
    if (recolor || existingRead != details.read) {
      read.removeAllViews()
      details.read?.let {
        val button = ui.labelButton(it, colors.onPrimary, colors.primary, colors.rippleColor, onAction).apply {
          minHeight = ui.dp(40f)
          setPaddingRelative(ui.dp(24f), 0, ui.dp(24f), 0)
          typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
          letterSpacing = 0.007f
        }
        read.addView(button,
          LayoutParams(MATCH_PARENT, WRAP_CONTENT))
      }
      existingRead = details.read
    }
    read.visibility = if (details.read == null) GONE else VISIBLE
    setText(chapterLabel, details.chapterLabel, colors.onSurface)
    ui.icon(filter, details.filter.glyph)
    val filterTint = if (details.filter.active) {
      details.filterActiveColor.takeUnless { it == 0 } ?: colors.primary
    } else {
      colors.onSurface
    }
    filter.setTextColor(filterTint)
    filter.contentDescription = details.filter.label
    ui.ripple(filter, colors.rippleColor)
    filter.setOnClickListener { onAction(details.filter.id) }
    chapters.isEnabled = details.chapterLabel.isNotEmpty()
    chapters.visibility = if (chapters.isEnabled) VISIBLE else GONE
    progress.visibility = if (details.busy) VISIBLE else GONE
  }

  private fun updateSummary() {
    val details = model ?: return
    val open = expanded
    summaryContainer.visibility = if (details.summary.isEmpty()) GONE else VISIBLE
    summary.maxLines = if (open) Int.MAX_VALUE else 3
    summary.setPaddingRelative(0, 0, 0, ui.dp(if (open) 24f else 8f))
    setText(summary, details.summary, theme?.onSurfaceVariant ?: Color.BLACK)
    val icon = if (open) details.collapseGlyph else details.expandGlyph
    ui.icon(summaryChevron, icon)
    summaryChevron.setTextColor(theme?.onSurface ?: Color.BLACK)
    summaryChevron.setBackgroundColor(ColorUtils.setAlphaComponent(details.background, if (open) 255 else 179))
    summaryChevron.visibility = if (icon.isEmpty() || details.summary.isEmpty()) GONE else VISIBLE
    if (android.os.Build.VERSION.SDK_INT >= 30) {
      summary.stateDescription = if (open) details.collapseLabel else details.expandLabel
    }
  }

  private fun renderActions(items: List<NovelDetailsAction>, colors: ChapterListTheme) {
    actions.removeAllViews()
    actions.visibility = if (items.isEmpty()) GONE else VISIBLE
    items.forEach { item ->
      val tint = if (item.active) colors.primary else colors.outline
      actions.addView(ui.column().apply {
        gravity = Gravity.CENTER
        setPaddingRelative(0, ui.dp(8f), 0, ui.dp(8f))
        addView(ui.text(24f, 1).apply {
          ui.icon(this, item.glyph)
          setTextColor(tint)
          importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        })
        addView(ui.text(12f, 2).apply {
          text = item.label
          gravity = Gravity.CENTER
          setTextColor(tint)
          importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = ui.dp(6f) })
        contentDescription = item.label
        ui.ripple(this, colors.rippleColor)
        setOnClickListener { onAction(item.id) }
        item.longPressId?.let { id -> setOnLongClickListener { onAction(id); true } }
      }, LayoutParams(0, WRAP_CONTENT, 1f).apply {
        marginStart = ui.dp(4f)
        marginEnd = ui.dp(4f)
      })
    }
  }

  private fun renderGenres(items: List<String>, colors: ChapterListTheme) {
    genres.removeAllViews()
    genreScroll.visibility = if (items.isEmpty()) GONE else VISIBLE
    items.forEach { name ->
      genres.addView(ui.text(14f, 1).apply {
        text = name
        setTextColor(colors.onSecondaryContainer)
        gravity = Gravity.CENTER
        setPaddingRelative(ui.dp(16f), 0, ui.dp(16f), 0)
        background = ui.pill(colors.secondaryContainer, 8f)
      }, LayoutParams(WRAP_CONTENT, ui.dp(32f)).apply { marginEnd = ui.dp(8f) })
    }
  }

  private fun renderPages(items: List<NovelDetailsAction>, colors: ChapterListTheme) {
    pages.removeAllViews()
    pages.visibility = if (items.isEmpty()) GONE else VISIBLE
    items.forEachIndexed { index, item ->
      val tint = if (item.active) colors.onPrimary else colors.onSurface
      val fill = if (item.active) colors.primary else colors.surface
      val button = ui.labelButton(item, tint, fill, colors.rippleColor, onAction).apply {
        minWidth = ui.dp(40f)
        minHeight = ui.dp(40f)
        setPaddingRelative(ui.dp(12f), 0, ui.dp(12f), 0)
        val border = ui.pill(fill, 8f).apply {
          if (!item.active) setStroke(ui.dp(1f), colors.outlineVariant)
        }
        background = android.graphics.drawable.RippleDrawable(
          android.content.res.ColorStateList.valueOf(colors.rippleColor), border, null,
        )
      }
      pages.addView(button, LayoutParams(0, WRAP_CONTENT, 1f).apply {
        if (index < items.lastIndex) marginEnd = ui.dp(8f)
      })
    }
  }

  private fun showCover() {
    val details = model ?: return
    val colors = theme ?: return
    val activity = reactContext.currentActivity ?: return
    coverDialog?.dismiss()
    val dialog = Dialog(activity, android.R.style.Theme_Material_NoActionBar)
    coverDialog = dialog
    dialog.setContentView(FrameLayout(activity).apply {
      setBackgroundColor(details.background)
      addView(NovelCoverView(activity, ScalingUtils.ScaleType.FIT_CENTER).apply {
        bind(details, colors.onSurfaceVariant)
        contentDescription = details.coverLabel
        setOnClickListener { dialog.dismiss() }
      }, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
      addView(ui.row().apply {
        details.coverActions.forEach { action ->
          addView(ui.iconButton(action, colors.onSurface, colors.rippleColor) { id ->
            dialog.dismiss()
            if (id != "dismiss-cover") onAction(id)
          })
        }
      }, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.TOP or Gravity.END))
    })
    dialog.setOnDismissListener { if (coverDialog === dialog) coverDialog = null }
    dialog.show()
  }

  fun dispose() {
    coverDialog?.dismiss()
  }

  private fun insetRow(top: Int = 0) = LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
    marginStart = ui.dp(16f)
    marginEnd = ui.dp(16f)
    topMargin = ui.dp(top.toFloat())
  }

  private fun metadataParams() = LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
    bottomMargin = ui.dp(8f)
  }

  private fun metadataRow(label: TextView, icon: TextView) = ui.row().apply {
    icon.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    addView(icon, LayoutParams(ui.dp(14f), WRAP_CONTENT).apply { marginEnd = ui.dp(4f) })
    addView(label, LayoutParams(0, WRAP_CONTENT, 1f))
  }

  private fun bindMetadata(row: LinearLayout, label: TextView, icon: TextView, text: String, glyph: String, tint: Int) {
    row.visibility = if (text.isEmpty()) GONE else VISIBLE
    setText(label, text, tint)
    ui.icon(icon, glyph, 14f)
    icon.setTextColor(tint)
  }

  private fun setText(view: TextView, text: String, color: Int) {
    if (view.text.toString() != text) view.text = text
    view.setTextColor(color)
    view.visibility = if (text.isEmpty()) GONE else VISIBLE
  }
}
