package com.margelo.nitro.nitrochapterlist.chapter

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.RippleDrawable
import android.graphics.drawable.ShapeDrawable
import android.graphics.drawable.shapes.OvalShape
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import com.margelo.nitro.nitrochapterlist.ChapterRow
import com.margelo.nitro.nitrochapterlist.grouped.GroupedCoverView

/** Colours (ARGB) and strings shared by every row; replaced as a whole on change. */
data class ChapterListTheme(
  val onSurface: Int = Color.BLACK,
  val onSurfaceVariant: Int = Color.DKGRAY,
  val outline: Int = Color.GRAY,
  val outlineVariant: Int = Color.LTGRAY,
  val primary: Int = Color.BLUE,
  val onPrimary: Int = Color.WHITE,
  val rippleColor: Int = 0x1F000000,
  val surface: Int = Color.WHITE,
  val surfaceVariant: Int = Color.LTGRAY,
  val selectedBackground: Int = 0x1F000000,
  val chapterTitleTemplate: String = "Chapter %{num}",
  val deleteLabel: String = "Delete",
  val downloadA11yLabel: String = "Download",
  val deleteA11yLabel: String = "Delete",
  val downloadingA11yLabel: String = "Downloading",
)

/**
 * One chapter row, laid out in code to mirror `ChapterItem`: 64dp tall, 16dp
 * horizontal and 8dp vertical padding; [bookmark] [unread dot + title / subtitle]
 * [download button]. Mirrors itself in RTL.
 */
@SuppressLint("ViewConstructor")
class ChapterRowView(context: Context, grouped: Boolean = false) : ViewGroup(context) {
  enum class DownloadState { HIDDEN, DOWNLOAD, DOWNLOADING, DOWNLOADED, EXPANDED, COLLAPSED }

  val cover = if (grouped) GroupedCoverView(context) else null
  private val novelTitle = if (grouped) createText(14f) else null

  private val density = resources.displayMetrics.density
  private fun dp(value: Float) = Math.round(value * density)

  private val coverSize = dp(40f)
  private val coverMargin = dp(16f)
  private val rowHeight = dp(ROW_HEIGHT_DP)
  private val paddingH = dp(16f)
  private val buttonSize = dp(40f)
  private val bookmarkMarginStart = dp(2f)
  private val bookmarkPadding = dp(8f)
  private val dotMarginEnd = dp(4f)
  private val subtitleMarginTop = dp(4f)

  private val bookmark = IconView(context, 18f).apply { setGlyph(IconView.BOOKMARK) }
  private val unreadDot = IconView(context, 8f).apply { setGlyph(IconView.CIRCLE) }
  private val title = createText(14f)
  private val subtitle = createText(12f)
  private val downloadIcon = IconView(context, 25f)
  private val downloadSpinner =
    ProgressBar(context).apply {
      isIndeterminate = true
      importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }
  val downloadButton =
    FrameLayout(context).apply {
      isClickable = true
      isFocusable = true
      addView(downloadIcon, FrameLayout.LayoutParams(WRAP, WRAP, Gravity.CENTER))
      val spinnerSize = dp(25f)
      addView(downloadSpinner, FrameLayout.LayoutParams(spinnerSize, spinnerSize, Gravity.CENTER))
    }

  private val selectedLayer = ColorDrawable(Color.TRANSPARENT)
  private var theme: ChapterListTheme? = null
  private var unread = false
  private var bookmarked = false
  private var downloadState = DownloadState.HIDDEN

  init {
    isClickable = true
    isLongClickable = !grouped
    isFocusable = true
    cover?.let { addView(it) }
    novelTitle?.let { addView(it) }
    addView(bookmark)
    addView(unreadDot)
    addView(title)
    addView(subtitle)
    addView(downloadButton)
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, rowHeight)
  }

  private fun createText(sizeSp: Float) =
    TextView(context).apply {
      // A non-wrap width lets setText skip requestLayout when the line height
      // is unchanged, so rebinding a row only redraws it.
      layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
      setSingleLine(true)
      maxLines = 1
      ellipsize = TextUtils.TruncateAt.END
      textAlignment = TEXT_ALIGNMENT_VIEW_START
    }

  /** Call when the theme object changes; rows remember the last one they applied. */
  fun applyTheme(value: ChapterListTheme) {
    if (theme === value) return
    theme = value
    background =
      RippleDrawable(ColorStateList.valueOf(value.rippleColor), selectedLayer, ColorDrawable(Color.WHITE))
    downloadButton.background =
      RippleDrawable(ColorStateList.valueOf(value.rippleColor), null, ShapeDrawable(OvalShape()))
    cover?.applyColors(value.surfaceVariant, value.onSurfaceVariant)
    bookmark.setColor(value.primary)
    unreadDot.setColor(value.primary)
    downloadSpinner.indeterminateTintList = ColorStateList.valueOf(value.outline)
    applyTextColors()
    applyDownloadState(downloadState, force = true)
    if (isSelected) selectedLayer.color = value.selectedBackground
  }

  fun bindRow(row: ChapterRow, formatter: ChapterRowFormatter) {
    title.text = formatter.title(row)
    val subtitleText = formatter.subtitle(row)
    if (subtitleText.isEmpty()) {
      subtitle.visibility = GONE
    } else {
      subtitle.text = subtitleText
      subtitle.visibility = VISIBLE
    }
    unread = row.unread
    bookmarked = row.bookmarked
    unreadDot.visibility = if (unread) VISIBLE else GONE
    bookmark.visibility = if (bookmarked) VISIBLE else GONE
    applyTextColors()
  }

  fun bindGroupedChapter(novelName: String, chapterTitle: String, unread: Boolean, bookmarked: Boolean) {
    novelTitle?.apply {
      text = novelName
      visibility = VISIBLE
    }
    title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
    title.text = chapterTitle
    subtitle.visibility = GONE
    this.unread = unread
    this.bookmarked = bookmarked
    unreadDot.visibility = if (unread) VISIBLE else GONE
    bookmark.visibility = if (bookmarked) VISIBLE else GONE
    applyTextColors()
  }

  fun bindGroup(name: String, count: String, expanded: Boolean) {
    novelTitle?.visibility = GONE
    title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
    title.text = name
    subtitle.text = count
    subtitle.visibility = VISIBLE
    unread = true
    bookmarked = false
    unreadDot.visibility = GONE
    bookmark.visibility = GONE
    applyTextColors()
    bindDownloadState(if (expanded) DownloadState.EXPANDED else DownloadState.COLLAPSED)
  }

  /** Rows that aren't loaded yet: same size, no content. */
  fun bindPlaceholder() {
    title.text = null
    subtitle.visibility = GONE
    unreadDot.visibility = GONE
    bookmark.visibility = GONE
    bindSelected(false)
    bindDownloadState(DownloadState.HIDDEN)
  }

  fun bindSelected(selected: Boolean) {
    isSelected = selected
    selectedLayer.color = if (selected) theme?.selectedBackground ?: Color.TRANSPARENT else Color.TRANSPARENT
  }

  fun bindDownloadState(state: DownloadState) {
    applyDownloadState(state, force = false)
  }

  private fun applyDownloadState(state: DownloadState, force: Boolean) {
    if (!force && state == downloadState) return
    val previous = downloadState
    downloadState = state
    val theme = theme ?: return
    downloadButton.visibility = if (state == DownloadState.HIDDEN) GONE else VISIBLE
    downloadSpinner.visibility = if (state == DownloadState.DOWNLOADING) VISIBLE else GONE
    downloadIcon.visibility =
      if (state == DownloadState.DOWNLOADING || state == DownloadState.HIDDEN) GONE else VISIBLE
    downloadButton.isClickable = state == DownloadState.DOWNLOAD || state == DownloadState.DOWNLOADED
    downloadButton.isFocusable = downloadButton.isClickable
    when (state) {
      DownloadState.DOWNLOAD -> {
        downloadIcon.setGlyph(IconView.DOWNLOAD)
        downloadIcon.setColor(theme.outline)
        downloadButton.contentDescription = theme.downloadA11yLabel
      }
      DownloadState.DOWNLOADED -> {
        downloadIcon.setGlyph(IconView.DOWNLOADED)
        downloadIcon.setColor(theme.onSurface)
        downloadButton.contentDescription = theme.deleteA11yLabel
      }
      DownloadState.DOWNLOADING -> downloadButton.contentDescription = theme.downloadingA11yLabel
      DownloadState.EXPANDED, DownloadState.COLLAPSED -> {
        downloadIcon.setGlyph(if (state == DownloadState.EXPANDED) IconView.CHEVRON_UP else IconView.CHEVRON_DOWN)
        downloadIcon.setColor(theme.onSurfaceVariant)
        downloadButton.contentDescription = null
      }
      DownloadState.HIDDEN -> downloadButton.contentDescription = null
    }
    if ((previous == DownloadState.HIDDEN) != (state == DownloadState.HIDDEN)) requestLayout()
  }

  private fun applyTextColors() {
    val theme = theme ?: return
    novelTitle?.setTextColor(if (unread) theme.onSurface else theme.outline)
    title.setTextColor(
      when {
        !unread -> theme.outline
        bookmarked -> theme.primary
        else -> theme.onSurface
      },
    )
    subtitle.setTextColor(
      when {
        !unread -> theme.outline
        bookmarked -> theme.primary
        else -> theme.onSurfaceVariant
      },
    )
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val width = MeasureSpec.getSize(widthMeasureSpec)
    val exact = MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
    var start = paddingH
    var end = width - paddingH
    cover?.let {
      it.measure(exactly(coverSize), exactly(coverSize))
      start += coverSize + coverMargin
    }
    if (bookmark.visibility != GONE) {
      val box = bookmark.boxSize + bookmarkPadding * 2
      bookmark.measure(exactly(box), exactly(box))
      start += bookmarkMarginStart + box
    }
    if (downloadButton.visibility != GONE) {
      downloadButton.measure(exactly(buttonSize), exactly(buttonSize))
      end -= buttonSize
    }
    novelTitle?.takeIf { it.visibility == VISIBLE }?.measure(exactly((end - start).coerceAtLeast(0)), exact)
    var titleStart = start
    if (unreadDot.visibility != GONE) {
      unreadDot.measure(exact, exact)
      titleStart += unreadDot.measuredWidth + dotMarginEnd
    }
    title.measure(exactly((end - titleStart).coerceAtLeast(0)), exact)
    if (subtitle.visibility != GONE) {
      subtitle.measure(exactly((end - start).coerceAtLeast(0)), exact)
    }
    setMeasuredDimension(width, rowHeight)
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    val width = r - l
    val height = b - t
    val rtl = layoutDirection == LAYOUT_DIRECTION_RTL
    var start = paddingH
    var end = width - paddingH

    cover?.let {
      place(it, start, (height - coverSize) / 2, width, rtl)
      start += coverSize + coverMargin
    }
    if (bookmark.visibility != GONE) {
      start += bookmarkMarginStart
      place(bookmark, start, (height - bookmark.measuredHeight) / 2, width, rtl)
      start += bookmark.measuredWidth
    }
    if (downloadButton.visibility != GONE) {
      end -= buttonSize
      place(downloadButton, end, (height - buttonSize) / 2, width, rtl)
    }

    val titleHeight = title.measuredHeight
    val subtitleHeight =
      if (subtitle.visibility != GONE) subtitleMarginTop + subtitle.measuredHeight else 0
    val novel = novelTitle?.takeIf { it.visibility == VISIBLE }
    val novelHeight = novel?.measuredHeight ?: 0
    val top = (height - titleHeight - subtitleHeight - novelHeight) / 2
    if (novel != null) place(novel, start, top, width, rtl)
    val chapterTop = top + novelHeight

    var titleStart = start
    if (unreadDot.visibility != GONE) {
      place(unreadDot, start, chapterTop + (titleHeight - unreadDot.measuredHeight) / 2, width, rtl)
      titleStart += unreadDot.measuredWidth + dotMarginEnd
    }
    place(title, titleStart, chapterTop, width, rtl)
    if (subtitle.visibility != GONE) {
      place(subtitle, start, top + titleHeight + subtitleMarginTop, width, rtl)
    }
  }

  /** Lays [child] out at an LTR start offset, mirrored when [rtl]. */
  private fun place(child: View, startX: Int, top: Int, width: Int, rtl: Boolean) {
    val w = child.measuredWidth
    val left = if (rtl) width - startX - w else startX
    child.layout(left, top, left + w, top + child.measuredHeight)
  }

  override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
    super.onInitializeAccessibilityNodeInfo(info)
    info.className = Button::class.java.name
    when (downloadState) {
      DownloadState.EXPANDED -> info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_COLLAPSE)
      DownloadState.COLLAPSED -> info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_EXPAND)
      else -> Unit
    }
  }

  override fun performAccessibilityAction(action: Int, arguments: android.os.Bundle?): Boolean {
    val expand = AccessibilityNodeInfo.ACTION_EXPAND
    val collapse = AccessibilityNodeInfo.ACTION_COLLAPSE
    if ((action == expand && downloadState == DownloadState.COLLAPSED) ||
      (action == collapse && downloadState == DownloadState.EXPANDED)
    ) return performClick()
    return super.performAccessibilityAction(action, arguments)
  }

  /**
   * Rows have a fixed size, and RecyclerView measures and lays out every row it
   * binds. Letting a text or visibility change bubble up would schedule a
   * layout pass of the whole list (and of the RN host) on every bind while
   * scrolling, so only mark this row for re-measure.
   */
  override fun requestLayout() {
    forceLayout()
  }

  private fun exactly(size: Int) = MeasureSpec.makeMeasureSpec(size, MeasureSpec.EXACTLY)

  companion object {
    const val ROW_HEIGHT_DP = 64f
    private const val WRAP = FrameLayout.LayoutParams.WRAP_CONTENT
  }
}
