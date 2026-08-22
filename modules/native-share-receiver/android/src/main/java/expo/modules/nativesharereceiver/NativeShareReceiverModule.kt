package expo.modules.nativesharereceiver

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeShareReceiverModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeShareReceiver")

    Events("SharedText")

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

    OnNewIntent { intent ->
      extractSharedText(intent)?.let { text ->
        sendEvent("SharedText", mapOf("text" to text))
      }
    }
  }

  private fun extractSharedText(intent: Intent?): String? {
    if (intent?.action != Intent.ACTION_SEND) {
      return null
    }
    return intent.getStringExtra(Intent.EXTRA_TEXT)
  }
}
