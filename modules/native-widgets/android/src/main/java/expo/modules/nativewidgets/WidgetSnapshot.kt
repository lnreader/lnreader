package expo.modules.nativewidgets

import org.json.JSONArray
import java.text.NumberFormat
import org.json.JSONObject

/**
 * What the JS side last pushed through `NativeWidgets.setSnapshot`. The widgets
 * never read the app database themselves, so incognito filtering and every
 * query stays in one place (src/services/widgets).
 */
data class WidgetSnapshot(
    val incognito: Boolean,
    val reading: List<ReadingItem>,
    val updatesCount: Int,
    val updates: List<UpdateItem>,
    /** Chapters read per local day, keyed `yyyy-MM-dd`. */
    val readDays: Map<String, Int>,
    val strings: WidgetStrings,
) {
    companion object {
        val EMPTY = WidgetSnapshot(
            incognito = false,
            reading = emptyList(),
            updatesCount = 0,
            updates = emptyList(),
            readDays = emptyMap(),
            strings = WidgetStrings(emptyMap()),
        )

        fun parse(json: String?): WidgetSnapshot {
            if (json.isNullOrEmpty()) return EMPTY
            return try {
                val root = JSONObject(json)
                val updates = root.optJSONObject("updates")
                WidgetSnapshot(
                    incognito = root.optBoolean("incognito", false),
                    reading = root.optJSONArray("reading").mapObjects(ReadingItem::fromJson),
                    updatesCount = updates?.optInt("count", 0) ?: 0,
                    updates = updates?.optJSONArray("items").mapObjects(UpdateItem::fromJson),
                    readDays = root.optJSONObject("readDays")?.let { days ->
                        days.keys().asSequence().associateWith { days.optInt(it, 0) }
                    } ?: emptyMap(),
                    strings = WidgetStrings(
                        root.optJSONObject("strings")?.let { s ->
                            s.keys().asSequence().associateWith { s.optString(it) }
                        } ?: emptyMap(),
                    ),
                )
            } catch (_: Exception) {
                EMPTY
            }
        }
    }
}

data class ReadingItem(
    val novelId: Long,
    val chapterId: Long,
    val novelName: String,
    val chapterName: String,
    val chapterNumber: String,
    /** Novel progress in [0, 1], or null when the chapter count is unknown. */
    val novelProgress: Float?,
    /** Scroll progress inside the chapter in [0, 1]. */
    val chapterProgress: Float,
    val totalChapters: Int,
    val cover: String?,
) {
    /** Progress bars show how far through the novel; fall back to the chapter. */
    val barProgress: Float get() = novelProgress ?: chapterProgress

    companion object {
        fun fromJson(o: JSONObject) = ReadingItem(
            novelId = o.optLong("novelId"),
            chapterId = o.optLong("chapterId"),
            novelName = o.optString("novelName"),
            chapterName = o.optString("chapterName"),
            chapterNumber = o.optString("chapterNumber"),
            novelProgress = if (o.has("novelProgress") && !o.isNull("novelProgress")) {
                o.optDouble("novelProgress").toFloat().coerceIn(0f, 1f)
            } else {
                null
            },
            chapterProgress = o.optDouble("chapterProgress", 0.0).toFloat().coerceIn(0f, 1f),
            totalChapters = o.optInt("totalChapters", 0),
            cover = o.optStringOrNull("cover"),
        )
    }
}

data class UpdateItem(
    val novelId: Long,
    val chapterId: Long,
    val novelName: String,
    val chapterName: String,
    val chapterNumber: String,
    val updatedAt: Long,
    val cover: String?,
) {
    companion object {
        fun fromJson(o: JSONObject) = UpdateItem(
            novelId = o.optLong("novelId"),
            chapterId = o.optLong("chapterId"),
            novelName = o.optString("novelName"),
            chapterName = o.optString("chapterName"),
            chapterNumber = o.optString("chapterNumber"),
            updatedAt = o.optLong("updatedAt"),
            cover = o.optStringOrNull("cover"),
        )
    }
}

/**
 * Localized copy comes from the app's i18n strings so widgets follow the
 * in-app language; the English defaults cover the window before the app has
 * run once after install.
 */
class WidgetStrings(private val values: Map<String, String>) {
    private fun get(key: String, fallback: String, vararg args: Pair<String, Any>): String {
        var text = values[key]?.takeIf { it.isNotEmpty() } ?: fallback
        args.forEach { (name, value) -> text = text.replace("{$name}", value.toString()) }
        return text
    }

    val continueReading get() = get("continueReading", "Continue Reading")
    val newChapters get() = get("newChapters", "New Chapters")
    val resume get() = get("resume", "Resume")
    fun chapter(number: String) = get("chapter", "Ch. {number}", "number" to number)
    fun chapterProgress(number: String, total: Int, percent: Int) =
        get(
            "chapterProgress",
            "Ch. {number} of {total} · {percent}%",
            "number" to number,
            "total" to NumberFormat.getIntegerInstance().format(total),
            "percent" to percent,
        )

    /** "Ch. 412", or the chapter name when the number could not be parsed. */
    fun chapterLabel(number: String, name: String) = if (number.isEmpty()) name else chapter(number)

    /** "Ch. 412 · Name" for list rows. */
    fun chapterLine(number: String, name: String) =
        if (number.isEmpty()) name else "${chapter(number)} · $name"
    fun more(remaining: Int) = get("more", "+{remaining} more", "remaining" to remaining)
    val updating get() = get("updating", "Updating")
    fun updatingProgress(done: Int, total: Int) =
        get("updatingProgress", "Updating · {done}/{total}", "done" to done, "total" to total)
    val update get() = get("update", "Update")
    val search get() = get("search", "Search")
    val random get() = get("random", "Random")
    val downloads get() = get("downloads", "Downloads")
    val chaptersThisWeek get() = get("chaptersThisWeek", "Chapters this week")
    fun streak(days: Int) = get("streak", "{days}-day streak", "days" to days)
    val nothingRead get() = get("nothingRead", "Nothing read yet")
    val nothingReadDesc get() = get("nothingReadDesc", "Find a novel to start reading")
    val browse get() = get("browse", "Browse")
    val caughtUp get() = get("caughtUp", "You're all caught up")
    val caughtUpDesc get() = get("caughtUpDesc", "No new chapters in your library")
    val openLibrary get() = get("openLibrary", "Open Library")
    val noChaptersThisWeek get() = get("noChaptersThisWeek", "No chapters read this week")
    val incognito get() = get("incognito", "Incognito mode is on")
    val incognitoDesc get() = get("incognitoDesc", "Reading history is hidden")
    val updateNotificationTitle get() = get("updateNotificationTitle", "Updating Library")
    val updateNotificationDescription get() = get("updateNotificationDescription", "Preparing")
}

private fun <T> JSONArray?.mapObjects(transform: (JSONObject) -> T): List<T> {
    if (this == null) return emptyList()
    return (0 until length()).mapNotNull { index -> optJSONObject(index)?.let(transform) }
}

private fun JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }
