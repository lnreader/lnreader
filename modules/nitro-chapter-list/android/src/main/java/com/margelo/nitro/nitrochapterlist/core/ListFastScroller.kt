/*
 * Copyright 2018 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.margelo.nitro.nitrochapterlist.core

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.view.MotionEvent
import androidx.recyclerview.widget.RecyclerView
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Fork of androidx.recyclerview.widget.FastScroller (package-private upstream),
 * vertical only. Behaviour and timings are unchanged (500ms fade in/out, hide
 * 1500ms after scrolling or 1200ms after dragging, thumb-only grab, pressed
 * state, RTL), except:
 *
 * - the thumb has a fixed [thumbLength] and appears when there is at least one
 *   viewport of scrollable content beyond the visible area;
 * - the grab area is [touchWidth] wide, wider than the drawn thumb;
 * - dragging maps the thumb position to an absolute offset, and jumps
 *   (scrollToPositionWithOffset) instead of scrollBy when the step is more than
 *   a screen, so scrubbing never lays out the rows in between;
 * - [topInset]/[bottomInset] keep the thumb clear of overlay controls;
 * - the look: a [thickness]-wide pill thumb with fully round ends, inset
 *   [edgeMargin] from the edge, and no visible track.
 */
class ListFastScroller(private val recyclerView: ListRecyclerView) :
  RecyclerView.ItemDecoration(), RecyclerView.OnItemTouchListener {

  private val density = recyclerView.resources.displayMetrics.density
  private val thickness = (THICKNESS_DP * density).roundToInt()
  private val edgeMargin = (EDGE_MARGIN_DP * density).roundToInt()
  private val thumbLength = (THUMB_LENGTH_DP * density).roundToInt()
  private val touchWidth = (TOUCH_WIDTH_DP * density).roundToInt()
  private val minimumRange = (MINIMUM_RANGE_DP * density).roundToInt()

  // Drawn directly as a round rect with radius = half the thickness, so the
  // ends are always full semicircles.
  private val thumbPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val thumbRect = RectF()
  private var thumbColor = 0
  private var pressedThumbColor = 0
  private var thumbAlpha = 0
  private var thumbBaseColor = 0

  var topInset = 0
    set(value) {
      field = value
      requestRedraw()
    }
  var bottomInset = 0
    set(value) {
      field = value
      requestRedraw()
    }

  var enabled = true
    set(value) {
      if (field == value) return
      field = value
      if (!value) {
        needScrollbar = false
        setState(STATE_HIDDEN)
      }
    }

  private var recyclerViewWidth = 0
  private var recyclerViewHeight = 0
  private var thumbTop = 0
  private var grabOffset = 0f
  private var needScrollbar = false
  private var state = STATE_HIDDEN

  private val showHideAnimator = ValueAnimator.ofFloat(0f, 1f)
  private var animationState = ANIMATION_STATE_OUT
  private val hideRunnable = Runnable { hide(HIDE_DURATION_MS) }

  private val onScrollListener =
    object : RecyclerView.OnScrollListener() {
      override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
        updateScrollPosition()
      }
    }

  init {
    showHideAnimator.addListener(AnimatorListener())
    showHideAnimator.addUpdateListener(AnimatorUpdater())
    recyclerView.addItemDecoration(this)
    recyclerView.addOnItemTouchListener(this)
    recyclerView.addOnScrollListener(onScrollListener)
  }

  fun setColors(thumb: Int, pressedThumb: Int) {
    thumbColor = thumb
    pressedThumbColor = pressedThumb
    applyThumbColor(if (state == STATE_DRAGGING) pressedThumbColor else thumbColor)
    requestRedraw()
  }

  /** Re-evaluates the thumb after the content length changes (e.g. a new total). */
  fun onContentChanged() {
    if (state != STATE_HIDDEN) updateScrollPosition()
  }

  private fun applyThumbColor(color: Int) {
    thumbBaseColor = color
    thumbPaint.color = color
    // The fade animation's alpha on top of the colour's own alpha.
    thumbPaint.alpha = thumbAlpha * ((color ushr 24) and 0xFF) / 255
  }

  private fun requestRedraw() {
    recyclerView.invalidate()
  }

  private fun setState(newState: Int) {
    if (newState == STATE_DRAGGING && state != STATE_DRAGGING) {
      applyThumbColor(pressedThumbColor)
      cancelHide()
    }
    if (newState == STATE_HIDDEN) {
      requestRedraw()
    } else {
      show()
    }
    if (state == STATE_DRAGGING && newState != STATE_DRAGGING) {
      applyThumbColor(thumbColor)
      resetHideDelay(HIDE_DELAY_AFTER_DRAGGING_MS)
    } else if (newState == STATE_VISIBLE) {
      resetHideDelay(HIDE_DELAY_AFTER_VISIBLE_MS)
    }
    state = newState
  }

  private val isLayoutRtl: Boolean
    get() = recyclerView.layoutDirection == android.view.View.LAYOUT_DIRECTION_RTL

  private fun show() {
    when (animationState) {
      ANIMATION_STATE_FADING_OUT, ANIMATION_STATE_OUT -> {
        if (animationState == ANIMATION_STATE_FADING_OUT) showHideAnimator.cancel()
        animationState = ANIMATION_STATE_FADING_IN
        showHideAnimator.setFloatValues(showHideAnimator.animatedValue as Float, 1f)
        showHideAnimator.duration = SHOW_DURATION_MS
        showHideAnimator.startDelay = 0
        showHideAnimator.start()
      }
    }
  }

  private fun hide(duration: Long) {
    when (animationState) {
      ANIMATION_STATE_FADING_IN, ANIMATION_STATE_IN -> {
        if (animationState == ANIMATION_STATE_FADING_IN) showHideAnimator.cancel()
        animationState = ANIMATION_STATE_FADING_OUT
        showHideAnimator.setFloatValues(showHideAnimator.animatedValue as Float, 0f)
        showHideAnimator.duration = duration
        showHideAnimator.start()
      }
    }
  }

  private fun cancelHide() {
    recyclerView.removeCallbacks(hideRunnable)
  }

  private fun resetHideDelay(delay: Long) {
    cancelHide()
    recyclerView.postDelayed(hideRunnable, delay)
  }

  override fun onDrawOver(canvas: Canvas, parent: RecyclerView, state: RecyclerView.State) {
    if (recyclerViewWidth != recyclerView.width || recyclerViewHeight != recyclerView.height) {
      recyclerViewWidth = recyclerView.width
      recyclerViewHeight = recyclerView.height
      // This is due to the different events ordering when keyboard is opened or
      // retracted vs rotate. Hence to avoid corner cases we just disable the
      // scroller when size changed, and wait until the scroll position is recomputed
      // before showing it back.
      setState(STATE_HIDDEN)
      return
    }
    if (this.state != STATE_HIDDEN && animationState != ANIMATION_STATE_OUT && needScrollbar) {
      drawVerticalScrollbar(canvas)
    }
  }

  private fun drawVerticalScrollbar(canvas: Canvas) {
    val left = if (isLayoutRtl) edgeMargin else recyclerViewWidth - edgeMargin - thickness
    thumbRect.set(left.toFloat(), thumbTop.toFloat(), (left + thickness).toFloat(), (thumbTop + thumbLength).toFloat())
    val radius = thickness / 2f
    canvas.drawRoundRect(thumbRect, radius, radius, thumbPaint)
  }


  private val trackTop: Int
    get() = topInset

  private val trackBottom: Int
    get() = max(trackTop, recyclerViewHeight - bottomInset)

  private fun updateScrollPosition() {
    val maxOffset = recyclerView.maxScrollOffset
    val trackLength = trackBottom - trackTop
    needScrollbar = enabled && recyclerViewHeight > 0 &&
      maxOffset >= recyclerViewHeight && trackLength >= minimumRange
    if (!needScrollbar) {
      if (state != STATE_HIDDEN) setState(STATE_HIDDEN)
      return
    }
    val travel = trackLength - thumbLength
    if (state == STATE_DRAGGING) {
      thumbTop = thumbTop.coerceIn(trackTop, trackTop + travel)
    } else {
      val fraction = recyclerView.computeVerticalScrollOffset().toFloat() / maxOffset
      thumbTop = trackTop + (travel * fraction.coerceIn(0f, 1f)).roundToInt()
    }
    if (state == STATE_HIDDEN || state == STATE_VISIBLE) setState(STATE_VISIBLE)
  }

  override fun onInterceptTouchEvent(rv: RecyclerView, ev: MotionEvent): Boolean {
    return when (state) {
      STATE_VISIBLE -> {
        if (ev.action == MotionEvent.ACTION_DOWN && isPointInsideThumb(ev.x, ev.y)) {
          startDrag(ev.y)
          true
        } else {
          false
        }
      }
      STATE_DRAGGING -> true
      else -> false
    }
  }

  override fun onTouchEvent(rv: RecyclerView, me: MotionEvent) {
    if (state == STATE_HIDDEN) return
    when (me.action) {
      MotionEvent.ACTION_DOWN -> if (isPointInsideThumb(me.x, me.y)) startDrag(me.y)
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL ->
        if (state == STATE_DRAGGING) {
          setState(STATE_VISIBLE)
        }
      MotionEvent.ACTION_MOVE ->
        if (state == STATE_DRAGGING) {
          show()
          dragTo(me.y)
        }
    }
  }

  override fun onRequestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {}

  private fun startDrag(y: Float) {
    recyclerView.stopScroll()
    grabOffset = y - thumbTop
    setState(STATE_DRAGGING)
  }

  private fun dragTo(y: Float) {
    val trackLength = trackBottom - trackTop
    val travel = trackLength - thumbLength
    if (travel <= 0) return
    val newTop = (y - grabOffset).roundToInt().coerceIn(trackTop, trackTop + travel)
    if (abs(newTop - thumbTop) < 1) return
    thumbTop = newTop
    val maxOffset = recyclerView.maxScrollOffset
    val target = ((newTop - trackTop).toLong() * maxOffset / travel).toInt()
    val delta = target - recyclerView.computeVerticalScrollOffset()
    if (abs(delta) > recyclerViewHeight) {
      recyclerView.jumpToOffset(target)
    } else if (delta != 0) {
      recyclerView.scrollBy(0, delta)
    }
    requestRedraw()
  }

  private fun isPointInsideThumb(x: Float, y: Float): Boolean {
    val insideX = if (isLayoutRtl) x <= touchWidth else x >= recyclerViewWidth - touchWidth
    return insideX && y >= thumbTop && y <= thumbTop + thumbLength
  }

  private inner class AnimatorListener : AnimatorListenerAdapter() {
    private var canceled = false

    override fun onAnimationEnd(animation: Animator) {
      // Cancel is always followed by a new directive, so don't update state.
      if (canceled) {
        canceled = false
        return
      }
      if (showHideAnimator.animatedValue as Float == 0f) {
        animationState = ANIMATION_STATE_OUT
        setState(STATE_HIDDEN)
      } else {
        animationState = ANIMATION_STATE_IN
        requestRedraw()
      }
    }

    override fun onAnimationCancel(animation: Animator) {
      canceled = true
    }
  }

  private inner class AnimatorUpdater : ValueAnimator.AnimatorUpdateListener {
    override fun onAnimationUpdate(valueAnimator: ValueAnimator) {
      val alpha = (SCROLLBAR_FULL_OPAQUE * valueAnimator.animatedValue as Float).toInt()
      thumbAlpha = alpha
      applyThumbColor(thumbBaseColor)
      requestRedraw()
    }
  }

  private companion object {
    const val STATE_HIDDEN = 0
    const val STATE_VISIBLE = 1
    const val STATE_DRAGGING = 2

    const val ANIMATION_STATE_OUT = 0
    const val ANIMATION_STATE_FADING_IN = 1
    const val ANIMATION_STATE_IN = 2
    const val ANIMATION_STATE_FADING_OUT = 3

    const val SHOW_DURATION_MS = 500L
    const val HIDE_DELAY_AFTER_VISIBLE_MS = 1500L
    const val HIDE_DELAY_AFTER_DRAGGING_MS = 1200L
    const val HIDE_DURATION_MS = 500L
    const val SCROLLBAR_FULL_OPAQUE = 255

    const val THICKNESS_DP = 12f
    const val EDGE_MARGIN_DP = 8f
    const val THUMB_LENGTH_DP = 48f
    // From the edge: covers the inset, the thumb and a little beyond it.
    const val TOUCH_WIDTH_DP = 32f
    const val MINIMUM_RANGE_DP = 50f
  }
}
