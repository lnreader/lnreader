package expo.modules.nativewidgets

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

data class LibraryUpdateState(val done: Int, val total: Int)

data class WidgetState(
    val snapshot: WidgetSnapshot,
    /** Full-size cover for the first Continue Reading entry, keyed by cover URI. */
    val heroCovers: Map<String, Bitmap>,
    /** Small covers for list rows, keyed by cover URI. */
    val thumbCovers: Map<String, Bitmap>,
    /** Non-null while a library update is running. */
    val libraryUpdate: LibraryUpdateState?,
) {
    companion object {
        val EMPTY = WidgetState(WidgetSnapshot.EMPTY, emptyMap(), emptyMap(), null)
    }
}

/**
 * Single source of truth for every widget. Each widget composition collects
 * [state], so pushing new data recomposes running sessions; [refresh] also
 * calls `updateAll` to start sessions for widgets that are not running.
 */
object WidgetRepository {
    private const val PREFS = "lnreader_widgets"
    private const val KEY_SNAPSHOT = "snapshot"
    private const val KEY_UPDATE_RUNNING = "library_update_running"
    private const val KEY_UPDATE_DONE = "library_update_done"
    private const val KEY_UPDATE_TOTAL = "library_update_total"
    private const val KEY_UPDATE_HEARTBEAT = "library_update_heartbeat"

    // A crashed or killed update task never reports that it finished. Stop
    // spinning once it has been quiet for this long.
    private const val UPDATE_STALE_MS = 20 * 60 * 1000L

    private const val MAX_THUMBS = 6

    private val mutex = Mutex()
    private val _state = MutableStateFlow(WidgetState.EMPTY)
    val state: StateFlow<WidgetState> = _state.asStateFlow()

    @Volatile
    private var loaded = false

    private val receivers = listOf(
        ContinueReadingWidgetReceiver::class.java,
        ContinueReadingMediumWidgetReceiver::class.java,
        ContinueReadingLargeWidgetReceiver::class.java,
        NewChaptersWidgetReceiver::class.java,
        NewChaptersLargeWidgetReceiver::class.java,
        ReadingStatsWidgetReceiver::class.java,
        QuickActionsWidgetReceiver::class.java,
    )

    fun installedWidgetCount(context: Context): Int {
        val manager = AppWidgetManager.getInstance(context)
        return receivers.sumOf { manager.getAppWidgetIds(ComponentName(context, it)).size }
    }

    suspend fun ensureLoaded(context: Context) {
        if (!loaded) reload(context)
    }

    fun saveSnapshot(context: Context, json: String) {
        prefs(context).edit().putString(KEY_SNAPSHOT, json).apply()
    }

    fun saveLibraryUpdate(context: Context, running: Boolean, done: Int, total: Int) {
        prefs(context).edit()
            .putBoolean(KEY_UPDATE_RUNNING, running)
            .putInt(KEY_UPDATE_DONE, done)
            .putInt(KEY_UPDATE_TOTAL, total)
            .putLong(KEY_UPDATE_HEARTBEAT, System.currentTimeMillis())
            .apply()
    }

    fun isLibraryUpdateRunning(context: Context): Boolean = readLibraryUpdate(context) != null

    /** Re-reads stored data, loads covers and re-renders [widgets]. */
    suspend fun refresh(context: Context, widgets: List<GlanceAppWidget> = allWidgets()) {
        reload(context)
        widgets.forEach { it.updateAll(context) }
    }

    /** Cheaper path for progress ticks: covers and snapshot are unchanged. */
    suspend fun refreshLibraryUpdate(context: Context) {
        mutex.withLock {
            _state.value = _state.value.copy(libraryUpdate = readLibraryUpdate(context))
        }
        listOf(NewChaptersWidget(), QuickActionsWidget()).forEach { it.updateAll(context) }
    }

    fun allWidgets(): List<GlanceAppWidget> = listOf(
        ContinueReadingWidget(),
        NewChaptersWidget(),
        ReadingStatsWidget(),
        QuickActionsWidget(),
    )

    private suspend fun reload(context: Context) = mutex.withLock {
        val snapshot = WidgetSnapshot.parse(prefs(context).getString(KEY_SNAPSHOT, null))
        val previous = _state.value
        val (hero, thumbs) = loadCovers(context, snapshot, previous)
        _state.value = WidgetState(
            snapshot = snapshot,
            heroCovers = hero,
            thumbCovers = thumbs,
            libraryUpdate = readLibraryUpdate(context),
        )
        loaded = true
    }

    private suspend fun loadCovers(
        context: Context,
        snapshot: WidgetSnapshot,
        previous: WidgetState,
    ): Pair<Map<String, Bitmap>, Map<String, Bitmap>> = withContext(Dispatchers.IO) {
        if (snapshot.incognito) return@withContext emptyMap<String, Bitmap>() to emptyMap()

        val heroUris = listOfNotNull(snapshot.reading.firstOrNull()?.cover)
        val thumbUris = (snapshot.reading.map { it.cover } + snapshot.updates.take(MAX_THUMBS).map { it.cover })
            .filterNotNull()
            .distinct()

        coroutineScope {
            val hero = heroUris.map { uri ->
                async { uri to (previous.heroCovers[uri] ?: CoverLoader.load(context, uri, CoverLoader.Size.HERO)) }
            }
            val thumbs = thumbUris.map { uri ->
                async { uri to (previous.thumbCovers[uri] ?: CoverLoader.load(context, uri, CoverLoader.Size.THUMB)) }
            }
            hero.awaitAll().toBitmapMap() to thumbs.awaitAll().toBitmapMap()
        }
    }

    private fun readLibraryUpdate(context: Context): LibraryUpdateState? {
        val prefs = prefs(context)
        if (!prefs.getBoolean(KEY_UPDATE_RUNNING, false)) return null
        val heartbeat = prefs.getLong(KEY_UPDATE_HEARTBEAT, 0L)
        if (System.currentTimeMillis() - heartbeat > UPDATE_STALE_MS) return null
        return LibraryUpdateState(
            done = prefs.getInt(KEY_UPDATE_DONE, 0),
            total = prefs.getInt(KEY_UPDATE_TOTAL, 0),
        )
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}

private fun List<Pair<String, Bitmap?>>.toBitmapMap(): Map<String, Bitmap> =
    mapNotNull { (uri, bitmap) -> bitmap?.let { uri to it } }.toMap()
