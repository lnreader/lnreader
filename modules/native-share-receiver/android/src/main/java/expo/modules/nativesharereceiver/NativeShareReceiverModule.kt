package expo.modules.nativesharereceiver

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class NativeShareReceiverModule : Module() {
  private val openedEpubs = mutableListOf<String>()

  override fun definition() = ModuleDefinition {
    Name("NativeShareReceiver")

    Events("SharedText", "EpubOpened")

    Function("getInitialSharedText") {
      val intent = appContext.currentActivity?.intent
      val text = extractSharedText(intent)
      if (text != null) {
        // Consume the share so JS reloads (Fast Refresh, OTA) that re-read
        // the activity intent don't re-deliver the same text.
        intent?.removeExtra(Intent.EXTRA_TEXT)
      }
      text
    }

    AsyncFunction("takeOpenedEpubs") {
      takeEpubUri(appContext.currentActivity?.intent)?.let { openedEpubs.add(0, it) }
      openedEpubs.toList().also { openedEpubs.clear() }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stageOpenedEpub") Coroutine { source: String ->
      val context = requireNotNull(appContext.reactContext).applicationContext
      withContext(Dispatchers.IO) {
        val uri = Uri.parse(source)
        val resolver = context.contentResolver
        val filename = if (uri.scheme == "content") {
          resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
        } else {
          null
        }
        // The Android URI grant can expire before a queued import starts.
        val staged = File.createTempFile("opened-epub-", ".epub", context.cacheDir)
        try {
          val input = resolver.openInputStream(uri) ?: throw IOException("Could not open EPUB")
          input.use { incoming ->
            staged.outputStream().use { output -> incoming.copyTo(output) }
          }
        } catch (error: Exception) {
          staged.delete()
          throw error
        }
        mapOf(
          "uri" to Uri.fromFile(staged).toString(),
          "filename" to (filename ?: uri.lastPathSegment?.substringAfterLast('/') ?: "Untitled.epub"),
        )
      }
    }

    OnNewIntent { intent ->
      extractSharedText(intent)?.let { text ->
        sendEvent("SharedText", mapOf("text" to text))
      }
      takeEpubUri(intent)?.let { uri ->
        openedEpubs.add(uri)
        sendEvent("EpubOpened", emptyMap<String, Any>())
      }
    }
  }

  private fun extractSharedText(intent: Intent?): String? {
    if (intent?.action != Intent.ACTION_SEND) {
      return null
    }
    return intent.getStringExtra(Intent.EXTRA_TEXT)
  }

  private fun takeEpubUri(intent: Intent?): String? {
    if (intent?.action != Intent.ACTION_VIEW) return null
    val uri = intent.data ?: return null
    if (uri.scheme != "content" && uri.scheme != "file") return null
    val type = intent.resolveType(requireNotNull(appContext.reactContext).contentResolver)
    if (type != "application/epub+zip" && type != "application/epub") return null
    intent.data = null
    return uri.toString()
  }
}
