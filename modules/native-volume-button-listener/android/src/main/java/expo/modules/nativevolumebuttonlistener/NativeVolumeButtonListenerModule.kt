package expo.modules.nativevolumebuttonlistener

import android.view.KeyEvent
import android.view.View
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeVolumeButtonListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeVolumeButtonListener")

    Events("VolumeUp", "VolumeDown")

    OnCreate {
      Companion.module = this@NativeVolumeButtonListenerModule
      setupKeyInterceptor(appContext)
    }

    OnDestroy {
      Companion.cleanup()
    }
  }

  companion object {
    var module: NativeVolumeButtonListenerModule? = null
    var isActive = false

    fun sendEvent(up: Boolean) {
      if (!isActive) return
      val eventName = if (up) "VolumeUp" else "VolumeDown"
      module?.sendEvent(eventName, mapOf<String, Any?>())
    }

    private val keyListener = View.OnKeyListener { _, keyCode, event ->
      if (isActive && event.action == KeyEvent.ACTION_DOWN) {
        when (keyCode) {
          KeyEvent.KEYCODE_VOLUME_UP -> {
            sendEvent(true)
            true
          }
          KeyEvent.KEYCODE_VOLUME_DOWN -> {
            sendEvent(false)
            true
          }
          else -> false
        }
      } else false
    }

    private var keyListenerAttached = false

    private fun setupKeyInterceptor(appContext: AppContext) {
      if (keyListenerAttached) return
      val activity = appContext.currentActivity ?: return
      val decorView = activity.window?.decorView ?: return
      decorView.setOnKeyListener(keyListener)
      keyListenerAttached = true
    }

    private fun cleanup() {
      module = null
      keyListenerAttached = false
    }
  }
}
