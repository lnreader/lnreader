package com.margelo.nitro.nitrochapterlist.novel

import android.app.Activity
import android.app.Dialog
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.content.Context
import android.widget.BaseAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.Switch
import androidx.core.widget.doAfterTextChanged
import com.margelo.nitro.nitrochapterlist.chapter.ChapterListTheme
import org.json.JSONObject

internal class NovelChapterJumpDialog(
  private val activity: Activity,
  private val config: JSONObject,
  private val details: NovelDetailsModel,
  private val colors: ChapterListTheme,
  private val nextRequest: () -> Int,
  private val onSearch: (Int, String, Boolean) -> Unit,
  private val onChoose: (Int, Int, Boolean) -> Boolean,
  private val onScroll: (Int) -> Boolean,
  private val onDismiss: () -> Unit,
) {
  private val dialog = Dialog(activity)
  private val ui = NovelDetailsWidgets(activity)
  private val labels = config.getJSONObject("labels")
  private val input = EditText(activity)
  private val error = ui.text(12f)
  private val results = ListView(activity)
  private val status = ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal).apply {
    isIndeterminate = true
    indeterminateTintList = ColorStateList.valueOf(colors.primary)
    visibility = View.GONE
  }
  private val byName = createSwitch("byName")
  private val open = createSwitch("open")
  private val searchButton = button("search", ::submit)
  private var request: Int? = null
  private var searching = false

  fun show() {
    val content = ui.column().apply {
      setPadding(ui.dp(24f), ui.dp(20f), ui.dp(24f), ui.dp(12f))
      background = ui.pill(details.toolbarColor, 24f)
      addView(ui.text(22f).apply {
        text = label("title")
        setTextColor(colors.onSurface)
        typeface = Typeface.DEFAULT_BOLD
      })
      addView(ui.text(14f).apply {
        text = label("description")
        setTextColor(colors.onSurfaceVariant)
      }, params(top = 6))
      addView(byName, params(top = 8))
      addView(input, params(top = 4))
      error.setTextColor(details.errorColor)
      addView(error)
      addView(open, params(top = 4))
      results.isNestedScrollingEnabled = true
      addView(results, params())
      addView(status, LinearLayout.LayoutParams(MATCH_PARENT, ui.dp(3f)))
      addView(ui.row().apply {
        gravity = Gravity.END
        addView(button("cancel", ::dismiss))
        addView(searchButton)
      }, params(top = 6))
    }
    dialog.setContentView(ScrollView(activity).apply {
      setFillViewport(false)
      background = ui.pill(details.toolbarColor, 24f)
      clipToOutline = true
      addView(content)
    })
    dialog.window?.apply {
      setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
      setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN)
      if (details.reduceMotion) setWindowAnimations(0)
    }
    dialog.setOnDismissListener {
      request = null
      onDismiss()
    }
    input.apply {
      setSingleLine()
      setTextColor(colors.onSurface)
      setHintTextColor(colors.onSurfaceVariant)
      backgroundTintList = ColorStateList.valueOf(colors.primary)
      imeOptions = EditorInfo.IME_ACTION_SEARCH
      setOnEditorActionListener { _, action, _ ->
        if (action != EditorInfo.IME_ACTION_SEARCH) false else { submit(); true }
      }
      doAfterTextChanged { reset() }
    }
    byName.setOnCheckedChangeListener { _, _ ->
      input.text.clear()
      bindMode()
    }
    bindMode()
    reset()
    content.isFocusableInTouchMode = true
    content.requestFocus()
    dialog.show()
    dialog.window?.setLayout(
      minOf(activity.resources.displayMetrics.widthPixels - ui.dp(40f), ui.dp(480f)), WRAP_CONTENT,
    )
  }

  fun dismiss() = dialog.dismiss()

  fun accept(result: JSONObject) {
    val id = request ?: return
    if (!dialog.isShowing || id != result.optInt("requestId")) return
    if (result.has("error")) {
      setBusy(false)
      error.text = result.getString("error")
      error.visibility = View.VISIBLE
      return
    }
    if (result.has("index")) {
      if (onScroll(result.getInt("index"))) {
        dismiss()
      } else {
        setBusy(false)
        error.text = label("invalidNumber")
        error.visibility = View.VISIBLE
      }
      return
    }
    val rows = result.optJSONArray("matches") ?: return
    if (rows.length() == 1) {
      choose(id, rows.getJSONObject(0).getInt("id"))
      return
    }
    results.adapter = object : BaseAdapter() {
      override fun getCount() = rows.length()
      override fun getItem(position: Int): JSONObject = rows.getJSONObject(position)
      override fun getItemId(position: Int) = getItem(position).getLong("id")
      override fun getView(position: Int, recycled: View?, parent: ViewGroup): View {
        val view = recycled as? LinearLayout ?: ui.column().apply {
          minimumHeight = ui.dp(44f)
          setPadding(ui.dp(4f), ui.dp(5f), ui.dp(4f), ui.dp(5f))
          addView(ui.text(14f, 1).apply { setTextColor(colors.onSurface) })
          addView(ui.text(12f, 1).apply { setTextColor(colors.onSurfaceVariant) })
        }
        val row = getItem(position)
        (view.getChildAt(0) as android.widget.TextView).text = row.getString("title")
        (view.getChildAt(1) as android.widget.TextView).apply {
          text = row.optString("date")
          visibility = if (text.isEmpty()) View.GONE else View.VISIBLE
        }
        return view
      }
    }
    results.setOnItemClickListener { _, _, position, _ -> choose(id, rows.getJSONObject(position).getInt("id")) }
    results.layoutParams = params(top = 4).apply { height = minOf(ui.dp(52f) * rows.length(), ui.dp(156f)) }
    results.visibility = View.VISIBLE
    setBusy(false)
  }

  private fun choose(requestId: Int, chapterId: Int) {
    if (request != requestId) return
    if (onChoose(requestId, chapterId, open.isChecked)) dismiss() else setBusy(true)
  }

  private fun submit() {
    if (searching) return
    val id = nextRequest()
    request = id
    error.visibility = View.GONE
    results.visibility = View.GONE
    setBusy(true)
    val keyboard = activity.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    keyboard.hideSoftInputFromWindow(input.windowToken, 0)
    onSearch(id, input.text.toString(), byName.isChecked)
  }

  private fun reset() {
    request = null
    error.visibility = View.GONE
    results.visibility = View.GONE
    setBusy(false)
  }

  private fun setBusy(busy: Boolean) {
    searching = busy
    searchButton.isEnabled = !busy
    results.isEnabled = !busy
    status.visibility = if (busy) View.VISIBLE else View.GONE
  }

  private fun bindMode() {
    val nameMode = byName.isChecked
    val max = config.optInt("maxNumber")
    input.hint = if (nameMode) label("name") else if (max > 0) "${label("number")} (1–$max)" else label("number")
    input.inputType = if (nameMode) InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
    else InputType.TYPE_CLASS_NUMBER
  }

  private fun createSwitch(key: String) = Switch(activity).apply {
    text = label(key)
    setTextColor(colors.onSurface)
    minHeight = ui.dp(48f)
    thumbTintList = ColorStateList(
      arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()), intArrayOf(colors.primary, colors.outline),
    )
  }

  private fun button(key: String, onClick: () -> Unit) =
    ui.labelButton(NovelDetailsAction(key, label(key), "", false, null, emptyList()),
      colors.primary, Color.TRANSPARENT, colors.rippleColor) { onClick() }

  private fun label(key: String) = labels.getString(key)

  private fun params(top: Int = 0) = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
    topMargin = ui.dp(top.toFloat())
  }
}
