package com.margelo.nitro.nitrochapterlist.novel

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.TextView
import androidx.core.view.setPadding
import com.facebook.react.common.assets.ReactFontManager
import kotlin.math.roundToInt

internal class NovelDetailsWidgets(private val context: Context) {
  private val iconFont by lazy {
    ReactFontManager.getInstance().getTypeface("MaterialDesignIcons", Typeface.NORMAL, context.assets)
  }

  fun dp(value: Float): Int = (value * context.resources.displayMetrics.density).roundToInt()

  fun row(): LinearLayout = LinearLayout(context).apply {
    orientation = LinearLayout.HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
  }

  fun column(): LinearLayout = LinearLayout(context).apply {
    orientation = LinearLayout.VERTICAL
  }

  fun text(size: Float, lines: Int = Int.MAX_VALUE): TextView = TextView(context).apply {
    textSize = size
    maxLines = lines
    ellipsize = TextUtils.TruncateAt.END
  }

  fun pill(color: Int, radius: Float = 24f): GradientDrawable = GradientDrawable().apply {
    cornerRadius = dp(radius).toFloat()
    setColor(color)
  }

  fun ripple(view: View, color: Int, fill: Int = Color.TRANSPARENT, radius: Float = 24f) {
    view.background = RippleDrawable(ColorStateList.valueOf(color), pill(fill, radius), pill(Color.WHITE, radius))
  }

  fun icon(view: TextView, glyph: String, size: Float = 24f) {
    view.typeface = iconFont
    view.text = glyph
    view.textSize = size
    view.gravity = Gravity.CENTER
    view.includeFontPadding = false
  }

  fun iconButton(action: NovelDetailsAction, color: Int, rippleColor: Int, onAction: (String) -> Unit) =
    text(24f, 1).apply {
      icon(this, action.glyph)
      contentDescription = action.label
      setTextColor(color)
      ripple(this, rippleColor)
      minWidth = dp(48f)
      minHeight = dp(48f)
      setOnClickListener {
        if (action.menu.isEmpty()) onAction(action.id)
        else PopupMenu(context, this).apply {
          action.menu.forEachIndexed { index, item -> menu.add(0, index, index, item.label) }
          setOnMenuItemClickListener { item ->
            onAction(action.menu[item.itemId].id)
            true
          }
          show()
        }
      }
    }

  fun labelButton(action: NovelDetailsAction, color: Int, fill: Int, rippleColor: Int, onAction: (String) -> Unit) =
    text(14f, 1).apply {
      gravity = Gravity.CENTER
      text = action.label
      setTextColor(color)
      minHeight = dp(44f)
      setPadding(dp(12f))
      ripple(this, rippleColor, fill)
      setOnClickListener { onAction(action.id) }
    }
}
