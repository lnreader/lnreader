package expo.modules.nativecloudflare

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeCloudflareModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("NativeCloudflare")

        AsyncFunction("solveChallenge") { url: String, userAgent: String, timeoutMs: Int, promise: Promise ->
            // The application context keeps this working from the headless
            // background-task service, where no Activity exists.
            val context = appContext.reactContext?.applicationContext
            if (context == null) {
                promise.resolve(false)
                return@AsyncFunction
            }
            CloudflareChallengeSolver(context, url, userAgent, timeoutMs.toLong()) { solved ->
                promise.resolve(solved)
            }.start()
        }
    }
}
