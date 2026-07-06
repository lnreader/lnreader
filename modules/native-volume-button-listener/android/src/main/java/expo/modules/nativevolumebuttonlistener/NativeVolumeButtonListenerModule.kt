package expo.modules.nativevolumebuttonlistener

import android.view.KeyEvent
import android.view.Window
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeVolumeButtonListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeVolumeButtonListener")

    Events("VolumeUp", "VolumeDown")

    Function("setActive") { active: Boolean ->
      isActive = active
    }

    OnCreate {
      Companion.module = this@NativeVolumeButtonListenerModule
    }

    OnActivityEntersForeground {
      setupKeyInterceptor(appContext)
    }

    OnDestroy {
      Companion.cleanup()
    }
  }

  companion object {
    var module: NativeVolumeButtonListenerModule? = null
    var isActive = false
    private var callbackAttached = false
    private var originalCallback: Window.Callback? = null

    fun sendEvent(up: Boolean) {
      if (!isActive) return
      val eventName = if (up) "VolumeUp" else "VolumeDown"
      module?.sendEvent(eventName, mapOf<String, Any?>())
    }

    private fun setupKeyInterceptor(appContext: AppContext) {
      if (callbackAttached) return
      val activity = appContext.currentActivity ?: return
      val window = activity.window ?: return
      originalCallback = window.callback
      window.callback = object : Window.Callback by (originalCallback ?: window.callback) {
        override fun dispatchKeyEvent(event: KeyEvent): Boolean {
          if (isActive && event.action == KeyEvent.ACTION_DOWN) {
            when (event.keyCode) {
              KeyEvent.KEYCODE_VOLUME_UP -> {
                sendEvent(true)
                return true
              }
              KeyEvent.KEYCODE_VOLUME_DOWN -> {
                sendEvent(false)
                return true
              }
            }
          }
          return originalCallback?.dispatchKeyEvent(event) ?: false
        }
      }
      callbackAttached = true
    }

    private fun cleanup() {
      val activity = module?.appContext?.currentActivity
      if (callbackAttached && activity != null) {
        val window = activity.window
        if (window != null && originalCallback != null) {
          window.callback = originalCallback
        }
      }
      module = null
      callbackAttached = false
      originalCallback = null
    }
  }
}
