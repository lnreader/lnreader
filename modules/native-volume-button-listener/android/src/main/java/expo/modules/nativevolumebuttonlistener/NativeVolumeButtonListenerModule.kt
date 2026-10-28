package expo.modules.nativevolumebuttonlistener

import android.view.KeyEvent
import android.view.Window
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeVolumeButtonListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeVolumeButtonListener")

    Events("VolumeUp", "VolumeDown", "PageUp", "PageDown")

    Function("setActive") { active: Boolean ->
      isActive = active
      if (active) setupKeyInterceptor(appContext)
    }

    OnCreate {
      Companion.module = this@NativeVolumeButtonListenerModule
    }

    OnActivityEntersForeground {
      if (isActive) setupKeyInterceptor(appContext)
    }

    OnDestroy {
      Companion.cleanup()
    }
  }

  companion object {
    var module: NativeVolumeButtonListenerModule? = null
    var isActive = false
    private var interceptedWindow: Window? = null
    private var keyInterceptor: Window.Callback? = null
    private var originalCallback: Window.Callback? = null

    private fun sendKeyEvent(eventName: String) {
      module?.sendEvent(eventName, mapOf<String, Any?>())
    }

    private fun setupKeyInterceptor(appContext: AppContext) {
      val activity = appContext.currentActivity ?: return
      val window = activity.window
      if (window === interceptedWindow && window.callback === keyInterceptor) return

      cleanupInterceptor()
      val delegate = window.callback ?: return
      val interceptor = object : Window.Callback by delegate {
        override fun dispatchKeyEvent(event: KeyEvent): Boolean {
          val eventName = when (event.keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP -> "VolumeUp"
            KeyEvent.KEYCODE_VOLUME_DOWN -> "VolumeDown"
            KeyEvent.KEYCODE_PAGE_UP -> "PageUp"
            KeyEvent.KEYCODE_PAGE_DOWN -> "PageDown"
            else -> null
          }
          if (isActive && eventName != null) {
            if (event.action == KeyEvent.ACTION_DOWN) {
              sendKeyEvent(eventName)
            }
            return true
          }
          return delegate.dispatchKeyEvent(event)
        }
      }
      originalCallback = delegate
      keyInterceptor = interceptor
      interceptedWindow = window
      window.callback = interceptor
    }

    private fun cleanupInterceptor() {
      val window = interceptedWindow
      val delegate = originalCallback
      if (window != null && window.callback === keyInterceptor && delegate != null) {
        window.callback = delegate
      }
      interceptedWindow = null
      keyInterceptor = null
      originalCallback = null
    }

    private fun cleanup() {
      cleanupInterceptor()
      module = null
      isActive = false
    }
  }
}
