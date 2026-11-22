package com.margelo.nitro.nitrochapterlist.novel

import android.app.Activity
import android.app.Dialog
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.LinearLayout
import android.widget.ScrollView
import androidx.core.view.ViewCompat
import androidx.viewpager.widget.PagerAdapter
import androidx.viewpager.widget.ViewPager
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.tabs.TabLayout
import com.margelo.nitro.nitrochapterlist.chapter.ChapterListTheme
import org.json.JSONObject

internal class NovelChapterSettingsSheet(
  private val activity: Activity,
  private val tab: Int,
  private val config: JSONObject,
  private val details: NovelDetailsModel,
  private val colors: ChapterListTheme,
  private val onChange: (String, String?, List<String>?) -> Unit,
  private val onDismiss: (Int) -> Unit,
) {
  private val dialog = BottomSheetDialog(activity, com.google.android.material.R.style.ThemeOverlay_MaterialComponents_BottomSheetDialog)
  private val ui = NovelDetailsWidgets(dialog.context)
  private val filters = config.strings("filters").toMutableSet()
  private var sort = config.optString("sort")
  private var showTitles = config.optBoolean("showTitles", true)
  private var excluded = config.strings("excludedScanlators").toSet()
  private val scanlators = config.strings("scanlators")
  private val labels = config.getJSONObject("labels")
  private val glyphs = config.getJSONObject("glyphs")
  private val tabLabels = config.strings("tabs")
  private val controls = List(tabLabels.size) { ui.column() }
  private var scanlatorDialog: Dialog? = null

  fun show() {
    val pager = object : ViewPager(dialog.context) {
      override fun setCurrentItem(item: Int) {
        setCurrentItem(item, !details.reduceMotion)
      }
    }.apply {
      adapter = object : PagerAdapter() {
        override fun getCount() = tabLabels.size
        override fun getPageTitle(position: Int) = tabLabels[position]
        override fun isViewFromObject(view: View, item: Any) = view === item
        override fun instantiateItem(container: ViewGroup, position: Int): Any {
          return ScrollView(dialog.context).apply {
            isFillViewport = true
            addView(controls[position])
            container.addView(this)
          }
        }
        override fun destroyItem(container: ViewGroup, position: Int, item: Any) {
          val page = item as ScrollView
          page.removeAllViews()
          container.removeView(page)
        }
      }
      setCurrentItem(tab, false)
    }
    val tabs = TabLayout(dialog.context).apply {
      setSelectedTabIndicatorColor(colors.primary)
      setTabTextColors(colors.onSurfaceVariant, colors.primary)
      setupWithViewPager(pager)
    }
    for (position in controls.indices) renderTab(position)
    val height = minOf(ui.dp(290f), activity.resources.displayMetrics.heightPixels / 2)
    dialog.setContentView(ui.column().apply {
      setBackgroundColor(details.toolbarColor)
      addView(tabs, params(MATCH_PARENT, ui.dp(48f)))
      addView(pager, params(MATCH_PARENT, 0).apply { weight = 1f })
      ViewCompat.setAccessibilityPaneTitle(this, tabLabels.firstOrNull())
    }, params(MATCH_PARENT, height))
    dialog.behavior.skipCollapsed = true
    dialog.behavior.state = BottomSheetBehavior.STATE_EXPANDED
    dialog.setOnDismissListener {
      scanlatorDialog?.dismiss()
      onDismiss(pager.currentItem)
    }
    if (details.reduceMotion) dialog.window?.setWindowAnimations(0)
    dialog.show()
  }

  fun dismiss() {
    scanlatorDialog?.dismiss()
    dialog.dismiss()
  }

  private fun renderTab(position: Int) {
    val page = controls[position]
    page.removeAllViews()
    when (position) {
      1 -> {
        sortRow(page, "position")
        sortRow(page, "name")
      }
      2 -> {
        val title = checkRow(page, labels.getString("sourceTitle"), if (showTitles) "on" else "off") {
          showTitles = true
          onChange("display", "title", null)
          renderTab(2)
        }
        title.isSelected = showTitles
        val number = checkRow(page, labels.getString("chapterNumber"), if (showTitles) "off" else "on") {
          showTitles = false
          onChange("display", "number", null)
          renderTab(2)
        }
        number.isSelected = !showTitles
      }
      else -> {
        filterRow(page, "downloaded")
        filterRow(page, "read", inverted = true)
        filterRow(page, "bookmarked")
        if (scanlators.isNotEmpty()) checkRow(page, labels.getString("scanlators"), "next", ::showScanlators)
      }
    }
  }

  private fun filterRow(page: LinearLayout, key: String, inverted: Boolean = false) {
    val positive = if (inverted) "not-$key" else key
    val negative = if (inverted) key else "not-$key"
    val state = when {
      positive in filters -> "on"
      negative in filters -> "partial"
      else -> "off"
    }
    checkRow(page, labels.getString(key), state) {
      filters.remove(positive)
      filters.remove(negative)
      when (state) {
        "off" -> filters.add(positive)
        "on" -> filters.add(negative)
      }
      onChange("filter", null, filters.toList())
      renderTab(0)
    }
  }

  private fun sortRow(page: LinearLayout, key: String) {
    val state = when (sort) {
      "${key}Asc" -> "asc"
      "${key}Desc" -> "desc"
      else -> "off"
    }
    checkRow(page, labels.getString(key), state) {
      sort = if (state == "asc") "${key}Desc" else "${key}Asc"
      onChange("sort", sort, null)
      renderTab(1)
    }
  }

  private fun checkRow(parent: LinearLayout, label: String, state: String, onClick: () -> Unit): View {
    val tint = if (state == "off") colors.onSurfaceVariant else colors.primary
    val row = ui.row().apply {
      minimumHeight = ui.dp(46f)
      setPaddingRelative(ui.dp(16f), 0, ui.dp(16f), 0)
      addView(ui.text(24f, 1).apply {
        ui.icon(this, glyphs.getString(state))
        setTextColor(tint)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      }, params(ui.dp(24f), WRAP_CONTENT))
      addView(ui.text(14f).apply {
        text = label
        setTextColor(colors.onSurface)
      }, params(0, WRAP_CONTENT).apply { weight = 1f; marginStart = ui.dp(8f) })
      ui.ripple(this, colors.rippleColor, radius = 0f)
      setOnClickListener { onClick() }
      isSelected = state == "on" || state == "asc" || state == "desc"
    }
    parent.addView(row, params(MATCH_PARENT, WRAP_CONTENT))
    return row
  }

  private fun showScanlators() {
    val chooser = Dialog(activity)
    scanlatorDialog = chooser
    val pending = excluded.toMutableSet()
    val list = ui.column()
    fun renderRows() {
      list.removeAllViews()
      scanlators.forEach { name ->
        checkRow(list, name, if (name in pending) "on" else "off") {
          if (!pending.remove(name)) pending.add(name)
          renderRows()
        }
      }
    }
    renderRows()
    chooser.setContentView(ui.column().apply {
      background = ui.pill(details.toolbarColor, 20f)
      setPadding(ui.dp(16f), ui.dp(16f), ui.dp(16f), ui.dp(8f))
      addView(ui.text(20f).apply {
        text = labels.getString("scanlators")
        setTextColor(colors.onSurface)
      })
      addView(ScrollView(dialog.context).apply { addView(list) }, params(
        MATCH_PARENT, minOf(ui.dp(46f) * scanlators.size, activity.resources.displayMetrics.heightPixels / 2),
      ))
      addView(ui.row().apply {
        gravity = Gravity.END
        fun button(key: String, action: () -> Unit) {
          val item = NovelDetailsAction(key, labels.getString(key), "", false, null, emptyList())
          addView(ui.labelButton(item, colors.primary, Color.TRANSPARENT, colors.rippleColor) { action() })
        }
        button("reset") { pending.clear(); renderRows() }
        button("cancel") { chooser.dismiss() }
        button("submit") {
          excluded = pending.toSet()
          onChange("scanlators", null, excluded.toList())
          chooser.dismiss()
        }
      })
    })
    chooser.setOnDismissListener { if (scanlatorDialog === chooser) scanlatorDialog = null }
    chooser.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
    chooser.show()
    chooser.window?.setLayout(activity.resources.displayMetrics.widthPixels - ui.dp(40f), WRAP_CONTENT)
  }

  private fun params(width: Int, height: Int) = LinearLayout.LayoutParams(width, height)

  private fun JSONObject.strings(key: String): List<String> {
    val array = getJSONArray(key)
    return List(array.length(), array::getString)
  }
}
