package expo.modules.nativewidgets

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking

class NativeWidgetsModule : Module() {
    private val context: Context
        get() = requireNotNull(appContext.reactContext) { "React context is not available" }.applicationContext

    override fun definition() = ModuleDefinition {
        Name("NativeWidgets")

        AsyncFunction("hasWidgets") {
            WidgetRepository.installedWidgetCount(context) > 0
        }

        AsyncFunction("setSnapshot") { json: String ->
            runBlocking(Dispatchers.IO) {
                WidgetRepository.saveSnapshot(context, json)
                WidgetRepository.refresh(context)
            }
        }

        AsyncFunction("setLibraryUpdateState") { running: Boolean, done: Int, total: Int ->
            runBlocking(Dispatchers.IO) {
                WidgetRepository.saveLibraryUpdate(context, running, done, total)
                WidgetRepository.refreshLibraryUpdate(context)
            }
        }
    }
}
