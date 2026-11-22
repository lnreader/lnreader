package com.margelo.nitro.nitrochapterlist.novel

import org.json.JSONObject

internal data class NovelDetailsAction(
  val id: String,
  val label: String,
  val glyph: String,
  val active: Boolean,
  val longPressId: String?,
  val menu: List<NovelDetailsAction>,
) {
  companion object {
    fun fromJson(json: JSONObject): NovelDetailsAction = NovelDetailsAction(
      json.getString("id"),
      json.getString("label"),
      json.optString("glyph"),
      json.optBoolean("active"),
      json.optString("longPressId").ifEmpty { null },
      actions(json, "menu"),
    )

    fun actions(json: JSONObject, key: String): List<NovelDetailsAction> {
      val items = json.optJSONArray(key) ?: return emptyList()
      return List(items.length()) { fromJson(items.getJSONObject(it)) }
    }
  }
}

internal class NovelDetailsModel(private val json: JSONObject) {
  val title = json.getString("title")
  val author = json.optString("author")
  val artist = json.optString("artist")
  val source = json.getString("source")
  val authorGlyph = json.optString("authorGlyph")
  val artistGlyph = json.optString("artistGlyph")
  val sourceGlyph = json.optString("sourceGlyph")
  val cover = json.optString("cover")
  val coverHeaders = json.optJSONObject("coverHeaders")?.let { headers ->
    headers.keys().asSequence().associateWith(headers::getString)
  }.orEmpty()
  val coverLabel = json.getString("coverLabel")
  val coverActions = NovelDetailsAction.actions(json, "coverActions")
  val coverGlyph = json.getString("coverGlyph")
  val summary = json.getString("summary")
  val expandLabel = json.getString("expandLabel")
  val collapseLabel = json.getString("collapseLabel")
  val expandGlyph = json.optString("expandGlyph")
  val collapseGlyph = json.optString("collapseGlyph")
  val genres = json.optJSONArray("genres")?.let { genres ->
    List(genres.length(), genres::getString)
  }.orEmpty()
  val expandedSummary = json.optBoolean("expandedSummary")
  val hideBackdrop = json.optBoolean("hideBackdrop")
  val reduceMotion = json.optBoolean("reduceMotion")
  val busy = json.optBoolean("busy")
  val error = json.optString("error")
  val chapterLabel = json.getString("chapterLabel")
  val filter = NovelDetailsAction.fromJson(json.getJSONObject("filter"))
  val filterActiveColor = json.optInt("filterActiveColor")
  val actions = NovelDetailsAction.actions(json, "actions")
  val toolbar = NovelDetailsAction.actions(json, "toolbar")
  val selectionToolbar = NovelDetailsAction.actions(json, "selectionToolbar")
  val selectionActions = NovelDetailsAction.actions(json, "selectionActions")
  val selectionKey = json.optString("selectionKey").ifEmpty { null }
  val selectionHaptics = json.optBoolean("selectionHaptics")
  val read = json.optJSONObject("read")?.let(NovelDetailsAction::fromJson)
  val resume = json.optJSONObject("resume")?.let(NovelDetailsAction::fromJson)
  val scrollToTop = NovelDetailsAction.fromJson(json.getJSONObject("scrollToTop"))
  val pages = NovelDetailsAction.actions(json, "pages")
  val topInset = json.optDouble("topInset", 0.0).toFloat()
  val bottomInset = json.optDouble("bottomInset", 0.0).toFloat()
  val background = json.getInt("background")
  val toolbarColor = json.getInt("toolbarColor")
  val errorColor = json.optInt("errorColor", 0xffba1a1a.toInt())
  val chapterSettings = json.optJSONObject("chapterSettings")
  val chapterJump = json.optJSONObject("chapterJump")
  val chapterControlScope = json.optString("chapterControlScope")
}
