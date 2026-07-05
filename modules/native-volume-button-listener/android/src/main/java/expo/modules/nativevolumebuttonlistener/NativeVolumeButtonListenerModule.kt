package expo.modules.nativevolumebuttonlistener

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeVolumeButtonListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeVolumeButtonListener")

    Events("VolumeUp", "VolumeDown")

    OnCreate {
      Companion.module = this@NativeVolumeButtonListenerModule
    }

    OnDestroy {
      Companion.module = null
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
  }


}
