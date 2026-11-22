package com.margelo.nitro.nitrochapterlist.grouped

import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.view.Gravity
import android.widget.FrameLayout
import com.facebook.drawee.backends.pipeline.Fresco
import com.facebook.drawee.drawable.ScalingUtils
import com.facebook.drawee.generic.GenericDraweeHierarchyBuilder
import com.facebook.drawee.view.GenericDraweeView
import com.margelo.nitro.nitrochapterlist.chapter.IconView
import java.io.File

class GroupedCoverView(context: Context) : FrameLayout(context) {
  private val placeholder = IconView(context, 20f).apply { setGlyph(IconView.BOOK_OUTLINE) }
  private val image = GenericDraweeView(
    context,
    GenericDraweeHierarchyBuilder(resources)
      .setActualImageScaleType(ScalingUtils.ScaleType.CENTER_CROP)
      .build(),
  ).apply { importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO }
  private val shape = GradientDrawable().apply {
    cornerRadius = 4 * resources.displayMetrics.density
  }
  private var currentUri: String? = null

  init {
    background = shape
    clipToOutline = true
    isFocusable = true
    addView(placeholder, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER))
    addView(image, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun applyColors(background: Int, icon: Int) {
    shape.setColor(background)
    placeholder.setColor(icon)
    placeholder.alpha = 0.45f
  }

  fun bind(uri: String?, label: String) {
    contentDescription = label
    if (currentUri == uri) return
    currentUri = uri
    val source = when {
      uri.isNullOrBlank() -> null
      uri.startsWith("/") -> Uri.fromFile(File(uri))
      else -> Uri.parse(uri)
    }
    image.controller = source?.let {
      Fresco.newDraweeControllerBuilder().setUri(it).setOldController(image.controller).build()
    }
  }

  fun recycle() {
    currentUri = null
    image.controller = null
  }
}
