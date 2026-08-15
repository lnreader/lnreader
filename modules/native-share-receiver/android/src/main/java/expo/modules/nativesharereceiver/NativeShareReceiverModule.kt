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
      extractSharedText(intent)
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
