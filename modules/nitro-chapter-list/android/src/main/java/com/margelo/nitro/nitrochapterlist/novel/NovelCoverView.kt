package com.margelo.nitro.nitrochapterlist.novel

import android.content.Context
import android.graphics.Color
import android.widget.FrameLayout
import com.facebook.drawee.backends.pipeline.Fresco
import com.facebook.drawee.drawable.ScalingUtils
import com.facebook.react.bridge.Arguments
import com.facebook.react.views.image.ReactImageView

internal class NovelCoverView(
  context: Context,
  scale: ScalingUtils.ScaleType,
) : FrameLayout(context) {
  private val image = ReactImageView(context, Fresco.newDraweeControllerBuilder(), null, context).apply {
    setScaleType(scale)
    setFadeDuration(0)
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
  }
  private val placeholder = NovelDetailsWidgets(context).text(32f)
  private var uri: String? = null
  private var headers: Map<String, String> = emptyMap()

  init {
    addView(placeholder, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    addView(image, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun bind(model: NovelDetailsModel, tint: Int, background: Int = Color.TRANSPARENT, showPlaceholder: Boolean = true) {
    NovelDetailsWidgets(context).icon(placeholder, model.coverGlyph, 32f)
    placeholder.setTextColor(tint)
    placeholder.setBackgroundColor(background)
    placeholder.visibility = if (showPlaceholder) VISIBLE else GONE
    if (uri == model.cover && headers == model.coverHeaders) return
    uri = model.cover
    headers = model.coverHeaders
    image.setHeaders(Arguments.createMap().apply { headers.forEach { (key, value) -> putString(key, value) } })
    image.setSource(Arguments.createArray().apply {
      if (model.cover.isNotEmpty()) pushMap(Arguments.createMap().apply { putString("uri", model.cover) })
    })
    image.maybeUpdateView()
  }
}
