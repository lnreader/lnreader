package expo.modules.nativefile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.modules.network.CookieJarContainer
import com.facebook.react.modules.network.ForwardingCookieHandler
import com.facebook.react.modules.network.OkHttpClientProvider
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Headers
import okhttp3.JavaNetCookieJar
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.File
import java.io.FileOutputStream
import java.io.FileWriter
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.io.PushbackInputStream
import java.util.zip.GZIPInputStream
import kotlin.coroutines.coroutineContext

class NativeFileModule : Module() {
    private val BUFFER_SIZE = 4096
    private val okHttpClient = OkHttpClientProvider.createClient()
    private val coroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var pendingDocumentPromise: Promise? = null

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != CREATE_DOCUMENT_REQUEST && requestCode != PICK_DOCUMENT_REQUEST) return
            val promise = pendingDocumentPromise ?: return
            pendingDocumentPromise = null
            val uri = data?.data
            if (resultCode != Activity.RESULT_OK || uri == null) {
                promise.reject("ECANCELLED", "Document selection was cancelled")
                return
            }
            try {
                val flags = data.flags and
                    (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                appContext.reactContext?.contentResolver?.takePersistableUriPermission(uri, flags)
            } catch (_: SecurityException) {
                // Some providers do not support persisted grants.
            }
            promise.resolve(uri.toString())
        }
    }

    private fun getFileUri(filepath: String): Uri {
        var uri = Uri.parse(filepath)
        if (uri.scheme == null) {
            val file = File(filepath)
            if (file.isDirectory) {
                throw Exception("Invalid file, folder found!")
            }
            uri = Uri.parse("file://$filepath")
        }
        return uri
    }

    private fun getInputStream(filepath: String): InputStream {
        val uri = getFileUri(filepath)
        return appContext.reactContext?.contentResolver?.openInputStream(uri)
            ?: throw Exception("ENOENT: could not open an input stream for '$filepath'")
    }

    private val writeAccessByAPILevel: String
        get() = if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) "w" else "rwt"

    private fun getOutputStream(filepath: String): OutputStream {
        val uri = getFileUri(filepath)
        return appContext.reactContext?.contentResolver?.openOutputStream(uri, writeAccessByAPILevel)
            ?: throw Exception("ENOENT: could not open an output stream for '$filepath'")
    }

    private suspend fun copyFileContent(
        filepath: String,
        destPath: String,
        onDone: (() -> Unit)? = null,
    ) {
        try {
            val inputStream = getInputStream(filepath)
            try {
                val outputStream = getOutputStream(destPath)
                try {
                    val buffer = ByteArray(BUFFER_SIZE)
                    var length: Int
                    while (inputStream.read(buffer).also { length = it } > 0) {
                        coroutineContext.ensureActive()
                        outputStream.write(buffer, 0, length)
                    }
                } finally {
                    outputStream.close()
                }
            } finally {
                inputStream.close()
            }
            if (onDone != null) {
                onDone()
            }
        } catch (e: IOException) {
            throw Exception("Failed to copy file from '$filepath' to '$destPath': ${e.message}")
        }
    }

    private suspend fun deleteRecursive(fileOrDirectory: File) {
        coroutineContext.ensureActive()
        if (fileOrDirectory.isDirectory) {
            for (child in fileOrDirectory.listFiles().orEmpty()) {
                deleteRecursive(child)
            }
        }
        if (!fileOrDirectory.delete() && fileOrDirectory.exists()) {
            throw IOException("Failed to delete '${fileOrDirectory.absolutePath}'")
        }
    }

    private fun decompressStream(input: InputStream?): InputStream {
        val pb = PushbackInputStream(input, 2)
        val signature = ByteArray(2)
        val len = pb.read(signature)
        if (len == -1) return pb
        pb.unread(signature, 0, len)
        return if (signature[0] == 0x1f.toByte() && signature[1] == 0x8b.toByte())
            GZIPInputStream(pb) else pb
    }

    private fun rejectFileOperation(promise: Promise, operation: String, path: String, error: Exception) {
        if (error is CancellationException) {
            promise.reject("ECANCELLED", "File operation was cancelled", error)
            return
        }
        val code = if (error is SecurityException) "EACCES" else "EIO"
        promise.reject(code, "Failed to $operation '$path': ${error.message}", error)
    }

    override fun definition() = ModuleDefinition {
        Name("NativeFile")

        OnCreate {
            val cookieContainer = okHttpClient.cookieJar as CookieJarContainer
            val cookieHandler = ForwardingCookieHandler(appContext.reactContext)
            cookieContainer.setCookieJar(JavaNetCookieJar(cookieHandler))
            appContext.reactContext?.addActivityEventListener(activityEventListener)
        }

        OnDestroy {
            appContext.reactContext?.removeActivityEventListener(activityEventListener)
            pendingDocumentPromise?.reject("ECANCELLED", "Native file module invalidated")
            pendingDocumentPromise = null
            coroutineScope.cancel()
        }

        AsyncFunction("createDocument") { filename: String, mimeType: String, promise: Promise ->
            launchDocumentIntent(
                Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mimeType
                    putExtra(Intent.EXTRA_TITLE, filename)
                },
                CREATE_DOCUMENT_REQUEST,
                promise,
            )
        }

        AsyncFunction("pickDocument") { mimeType: String, promise: Promise ->
            launchDocumentIntent(
                Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mimeType
                },
                PICK_DOCUMENT_REQUEST,
                promise,
            )
        }

        AsyncFunction("writeFile") { path: String, content: String, promise: Promise ->
            coroutineScope.launch {
                try {
                    FileWriter(path).use { it.write(content) }
                    promise.resolve(null)
                } catch (e: Exception) {
                    rejectFileOperation(promise, "write", path, e)
                }
            }
        }

        AsyncFunction("readFile") { path: String, promise: Promise ->
            coroutineScope.launch {
                try {
                    val file = File(path)
                    if (!file.exists()) {
                        promise.reject("ENOENT", "File not found: '$path'")
                        return@launch
                    }
                    promise.resolve(file.bufferedReader().use { it.readText() })
                } catch (e: Exception) {
                    rejectFileOperation(promise, "read", path, e)
                }
            }
        }

        AsyncFunction("copyFile") { filepath: String, destPath: String, promise: Promise ->
            coroutineScope.launch {
                try {
                    copyFileContent(filepath, destPath)
                    promise.resolve(null)
                } catch (e: Exception) {
                    rejectFileOperation(promise, "copy", filepath, e)
                }
            }
        }

        AsyncFunction("moveFile") { filepath: String, destPath: String, promise: Promise ->
            coroutineScope.launch {
                try {
                    val inFile = File(filepath)
                    copyFileContent(filepath, destPath) {
                        if (!inFile.delete()) {
                            throw IOException("Failed to delete source file '$filepath'")
                        }
                    }
                    promise.resolve(null)
                } catch (e: Exception) {
                    rejectFileOperation(promise, "move", filepath, e)
                }
            }
        }

        AsyncFunction("exists") { filepath: String, promise: Promise ->
            coroutineScope.launch {
                try {
                    promise.resolve(File(filepath).exists())
                } catch (e: Exception) {
                    rejectFileOperation(promise, "inspect", filepath, e)
                }
            }
        }

        AsyncFunction("mkdir") { filepath: String, promise: Promise ->
            coroutineScope.launch {
                try {
                    val file = File(filepath)
                    if (!file.exists() && !file.mkdirs()) {
                        throw IOException("Directory could not be created")
                    }
                    promise.resolve(null)
                } catch (e: Exception) {
                    rejectFileOperation(promise, "create directory", filepath, e)
                }
            }
        }

        AsyncFunction("unlink") { filepath: String, promise: Promise ->
            coroutineScope.launch {
                try {
                    val file = File(filepath)
                    if (file.exists()) {
                        deleteRecursive(file)
                    }
                    promise.resolve(null)
                } catch (e: Exception) {
                    rejectFileOperation(promise, "delete", filepath, e)
                }
            }
        }

        AsyncFunction("readDir") { directory: String, promise: Promise ->
            coroutineScope.launch {
                try {
                    val file = File(directory)
                    if (!file.exists()) {
                        promise.reject("ENOENT", "Folder does not exist: '$directory'")
                        return@launch
                    }
                    val result = file.listFiles().orEmpty().map { childFile ->
                        mapOf(
                            "name" to childFile.name,
                            "path" to childFile.absolutePath,
                            "isDirectory" to childFile.isDirectory
                        )
                    }
                    promise.resolve(result)
                } catch (e: Exception) {
                    rejectFileOperation(promise, "list", directory, e)
                }
            }
        }

        AsyncFunction("downloadFile") { url: String, destPath: String, method: String, headers: Map<String, String>, body: String?, promise: Promise ->
            coroutineScope.launch {
                try {
                    val headersBuilder = Headers.Builder()
                    headers.forEach { (key, value) -> headersBuilder.add(key, value) }
                    val requestBuilder = Request.Builder()
                        .url(url)
                        .headers(headersBuilder.build())
                    if (method.lowercase() == "get") {
                        requestBuilder.get()
                    } else if (body != null) {
                        requestBuilder.post(body.toRequestBody())
                    }

                    okHttpClient.newCall(requestBuilder.build())
                        .enqueue(object : Callback {
                            override fun onFailure(call: Call, e: IOException) {
                                promise.reject(e)
                            }

                            override fun onResponse(call: Call, response: Response) {
                                response.use {
                                    if (!it.isSuccessful || it.body == null) {
                                        promise.reject(Exception("Failed to download: ${it.code}"))
                                        return
                                    }
                                    try {
                                        decompressStream(it.body!!.byteStream()).use { inputStream ->
                                            FileOutputStream(destPath).use { fos ->
                                                inputStream.copyTo(fos, BUFFER_SIZE)
                                            }
                                        }
                                        promise.resolve(null)
                                    } catch (e: Exception) {
                                        promise.reject(e)
                                    }
                                }
                            }
                        })
                } catch (e: Exception) {
                    promise.reject(e)
                }
            }
        }

        Constant("ExternalDirectoryPath") {
            val externalDirectory = appContext.reactContext?.getExternalFilesDir(null)
            externalDirectory?.absolutePath ?: ""
        }

        Constant("ExternalCachesDirectoryPath") {
            val externalCachesDirectory = appContext.reactContext?.externalCacheDir
            externalCachesDirectory?.absolutePath ?: ""
        }
    }

    private fun launchDocumentIntent(intent: Intent, requestCode: Int, promise: Promise) {
        val activity = appContext.reactContext?.currentActivity
        if (activity == null) {
            promise.reject("ENOACTIVITY", "A visible activity is required to select a document")
            return
        }
        if (pendingDocumentPromise != null) {
            promise.reject("EBUSY", "Another document selection is already active")
            return
        }
        pendingDocumentPromise = promise
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION or
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
        )
        activity.startActivityForResult(intent, requestCode)
    }

    companion object {
        private const val CREATE_DOCUMENT_REQUEST = 48120
        private const val PICK_DOCUMENT_REQUEST = 48121
    }
}