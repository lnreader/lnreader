package expo.modules.nativecloudflare

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Loads [url] in an off-screen WebView so Cloudflare's JavaScript challenge can
 * run, and reports whether a new `cf_clearance` cookie was issued.
 *
 * The WebView shares [CookieManager] with React Native's OkHttp cookie jar, so
 * once this succeeds a plain `fetch` retry carries the clearance cookie. The
 * cookie is bound to the user agent, which is why the caller passes the same one
 * it sends with `fetch`.
 *
 * Detection mirrors Mihon's CloudflareInterceptor: the challenge is identified
 * by the documented `cf-mitigated: challenge` header, and an interactive
 * (Turnstile checkbox) challenge aborts early because it cannot be solved
 * without the user.
 */
internal class CloudflareChallengeSolver(
    private val context: Context,
    private val url: String,
    private val userAgent: String,
    private val timeoutMs: Long,
    private val onDone: (Boolean) -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val cookieManager: CookieManager by lazy { CookieManager.getInstance() }
    private val timeout = Runnable { finish(false) }

    private var webView: WebView? = null
    private var previousClearance: String? = null
    // Set when the main-frame response being loaded is a challenge page, and
    // consumed when that page finishes, so every load (including one reached
    // through a redirect) is judged on its own response.
    private var pageChallenged = false
    private var finished = false

    fun start() {
        mainHandler.post {
            try {
                previousClearance = readClearance()
                webView = createWebView()
                mainHandler.postDelayed(timeout, timeoutMs)
                webView?.loadUrl(url)
            } catch (_: Exception) {
                // WebView can be missing or mid-update on some devices.
                finish(false)
            }
        }
    }

    private fun readClearance(): String? =
        cookieManager.getCookie(url)
            ?.split(';')
            ?.map { it.trim() }
            ?.firstOrNull { it.startsWith("$CLEARANCE_COOKIE=") }
            ?.substringAfter('=')

    private fun isSolved(): Boolean {
        val clearance = readClearance()
        return clearance != null && clearance != previousClearance
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView =
        WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.userAgentString = userAgent
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(this, true)
            addJavascriptInterface(InteractiveChallengeListener(), JS_INTERFACE)
            webViewClient = ChallengeClient()
        }

    private fun finish(solved: Boolean) {
        if (finished) return
        finished = true
        mainHandler.removeCallbacks(timeout)
        if (solved) {
            cookieManager.flush()
        }
        webView?.run {
            stopLoading()
            destroy()
        }
        webView = null
        onDone(solved)
    }

    private inner class ChallengeClient : WebViewClient() {
        override fun onReceivedHttpError(
            view: WebView,
            request: WebResourceRequest,
            errorResponse: WebResourceResponse,
        ) {
            if (!request.isForMainFrame) return
            val mitigated = errorResponse.responseHeaders
                ?.entries
                ?.firstOrNull { it.key.equals("cf-mitigated", ignoreCase = true) }
                ?.value
            if (mitigated == "challenge") {
                pageChallenged = true
            } else {
                // A plain error page (e.g. a firewall block) will not turn into a
                // clearance, but the challenge may already have issued one.
                finish(isSolved())
            }
        }

        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError,
        ) {
            if (request.isForMainFrame) {
                finish(isSolved())
            }
        }

        override fun onPageFinished(view: WebView, loadedUrl: String) {
            if (finished) return
            if (isSolved()) {
                finish(true)
                return
            }
            val challenged = pageChallenged
            pageChallenged = false
            if (!challenged) {
                // This page loaded without a challenge (also after a redirect), so
                // no clearance is coming; fail now instead of at the timeout.
                finish(false)
                return
            }
            view.evaluateJavascript(
                """
                addEventListener("message", ({ data }) => {
                  if (data?.source === "cloudflare-challenge" && data?.event === "interactiveBegin") {
                    $JS_INTERFACE.interactiveDetected();
                  }
                });
                """.trimIndent(),
                null,
            )
        }
    }

    private inner class InteractiveChallengeListener {
        @Suppress("unused")
        @JavascriptInterface
        fun interactiveDetected() {
            mainHandler.post { finish(false) }
        }
    }

    private companion object {
        const val CLEARANCE_COOKIE = "cf_clearance"
        const val JS_INTERFACE = "lnreaderCloudflare"
    }
}
