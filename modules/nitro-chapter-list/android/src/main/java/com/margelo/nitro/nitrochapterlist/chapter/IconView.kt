package com.margelo.nitro.nitrochapterlist.chapter

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.util.TypedValue
import android.view.View
import com.facebook.react.common.assets.ReactFontManager

/**
 * Draws one Material Design Icons glyph, centred, from the same font file the
 * RN app uses (`@react-native-vector-icons/material-design-icons`). Sized in sp,
 * like an RN vector icon, so it follows the system font scale.
 */
class IconView(context: Context, sizeSp: Float) : View(context) {
  private val paint =
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
      typeface = iconTypeface(context)
      textSize = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_SP,
        sizeSp,
        context.resources.displayMetrics,
      )
    }
  private val bounds = Rect()
  private var glyph: String = ""

  /** Box edge in px: the glyph's em size, as RN lays out a vector icon. */
  val boxSize: Int = Math.ceil(paint.textSize.toDouble()).toInt()

  init {
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
  }

  fun setGlyph(value: String) {
    if (glyph == value) return
    glyph = value
    paint.getTextBounds(glyph, 0, glyph.length, bounds)
    invalidate()
  }

  fun setColor(color: Int) {
    if (paint.color == color) return
    paint.color = color
    invalidate()
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(
      resolveSize(boxSize, widthMeasureSpec),
      resolveSize(boxSize, heightMeasureSpec),
    )
  }

  override fun onDraw(canvas: Canvas) {
    if (glyph.isEmpty()) return
    val x = (width - bounds.width()) / 2f - bounds.left
    val y = (height - bounds.height()) / 2f - bounds.top
    canvas.drawText(glyph, x, y, paint)
  }

  companion object {
    // Code points from MaterialDesignIcons.json in the vector-icons package.
    val CIRCLE = glyphOf(984933)
    val BOOKMARK = glyphOf(983232)
    val DOWNLOAD = glyphOf(986332) // arrow-down-circle-outline
    val DOWNLOADED = glyphOf(984544) // check-circle

    private fun glyphOf(codePoint: Int) = String(Character.toChars(codePoint))

    private var cachedTypeface: Typeface? = null

    fun iconTypeface(context: Context): Typeface {
      cachedTypeface?.let { return it }
      // Same lookup RN's Text does for fontFamily "MaterialDesignIcons".
      val typeface =
        ReactFontManager.getInstance()
          .getTypeface("MaterialDesignIcons", Typeface.NORMAL, context.assets)
      cachedTypeface = typeface
      return typeface
    }
  }
}
