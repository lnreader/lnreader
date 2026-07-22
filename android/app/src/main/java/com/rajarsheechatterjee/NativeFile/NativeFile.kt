package com.rajarsheechatterjee.NativeFile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.network.CookieJarContainer
import com.facebook.react.modules.network.ForwardingCookieHandler
import com.facebook.react.modules.network.OkHttpClientProvider
import com.lnreader.spec.NativeFileSpec
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


class NativeFile(context: ReactApplicationContext) :
    NativeFileSpec(context) {
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
                reactApplicationContext.contentResolver.takePersistableUriPermission(uri, flags)
            } catch (_: SecurityException) {
                // Some providers do not support persisted grants.
            }
            promise.resolve(uri.toString())
        }
    }

    init {
        reactApplicationContext.addActivityEventListener(activityEventListener)
        val cookieContainer = okHttpClient.cookieJar as CookieJarContainer
        val cookieHandler = ForwardingCookieHandler(reactApplicationContext)
        cookieContainer.setCookieJar(JavaNetCookieJar(cookieHandler))
    }

    override fun createDocument(filename: String, mimeType: String, promise: Promise) {
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

    override fun pickDocument(mimeType: String, promise: Promise) {
        launchDocumentIntent(
            Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = mimeType
            },
            PICK_DOCUMENT_REQUEST,
            promise,
        )
    }

    private fun launchDocumentIntent(intent: Intent, requestCode: Int, promise: Promise) {
        val activity = currentActivity
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

    private fun getFileUri(filepath: String): Uri {
        var uri = Uri.parse(filepath)
        if (uri.scheme == null) {
            // No prefix, assuming that provided path is absolute path to file
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
        return reactApplicationContext.contentResolver.openInputStream(uri)
            ?: throw Exception("ENOENT: could not open an input stream for '$filepath'")
    }

    private val writeAccessByAPILevel: String
        get() = if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) "w" else "rwt"

    private fun getOutputStream(filepath: String): OutputStream {
        val uri = getFileUri(filepath)
        return reactApplicationContext.contentResolver.openOutputStream(uri, writeAccessByAPILevel)
            ?: throw Exception("ENOENT: could not open an output stream for '$filepath'")
    }

    override fun writeFile(path: String, content: String, promise: Promise) {
        coroutineScope.launch {
            try {
                FileWriter(path).use { it.write(content) }
                promise.resolve(null)
            } catch (e: Exception) {
                rejectFileOperation(promise, "write", path, e)
            }
        }
    }

    override fun readFile(path: String, promise: Promise) {
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

    override fun copyFile(filepath: String, destPath: String, promise: Promise) {
        coroutineScope.launch {
            try {
                copyFileContent(filepath, destPath)
                promise.resolve(null)
            } catch (e: Exception) {
                rejectFileOperation(promise, "copy", filepath, e)
            }
        }
    }

    override fun moveFile(filepath: String, destPath: String, promise: Promise) {
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

    override fun exists(filepath: String, promise: Promise) {
        coroutineScope.launch {
            try {
                promise.resolve(File(filepath).exists())
            } catch (e: Exception) {
                rejectFileOperation(promise, "inspect", filepath, e)
            }
        }
    }

    override fun mkdir(filepath: String, promise: Promise) {
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

    override fun unlink(filepath: String, promise: Promise) {
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

    override fun readDir(directory: String, promise: Promise) {
        coroutineScope.launch {
            try {
                val file = File(directory)
                if (!file.exists()) {
                    promise.reject("ENOENT", "Folder does not exist: '$directory'")
                    return@launch
                }
                val fileMaps: WritableArray = WritableNativeArray()
                for (childFile in file.listFiles().orEmpty()) {
                    coroutineContext.ensureActive()
                    val fileMap: WritableMap = WritableNativeMap()
                    fileMap.putString("name", childFile.name)
                    fileMap.putString("path", childFile.absolutePath)
                    fileMap.putBoolean("isDirectory", childFile.isDirectory)
                    fileMaps.pushMap(fileMap)
                }
                promise.resolve(fileMaps)
            } catch (e: Exception) {
                rejectFileOperation(promise, "list", directory, e)
            }
        }
    }

    private fun rejectFileOperation(promise: Promise, operation: String, path: String, error: Exception) {
        if (error is CancellationException) {
            promise.reject("ECANCELLED", "File operation was cancelled", error)
            return
        }
        val code = if (error is SecurityException) "EACCES" else "EIO"
        promise.reject(code, "Failed to $operation '$path': ${error.message}", error)
    }

    private fun decompressStream(input: InputStream?): InputStream {
        val pb = PushbackInputStream(input, 2)
        val signature = ByteArray(2)
        val len = pb.read(signature)
        if(len == -1) return pb;
        pb.unread(signature, 0, len)
        return if (signature[0] == 0x1f.toByte() && signature[1] == 0x8b.toByte())
            GZIPInputStream(pb) else pb
    }

    override fun downloadFile(
        url: String,
        destPath: String,
        method: String,
        headers: ReadableMap,
        body: String?,
        promise: Promise
    ) {
        coroutineScope.launch {
            try {
                val headersBuilder = Headers.Builder()
                headers.entryIterator.forEach { entry ->
                    headersBuilder.add(entry.key, entry.value.toString())
                }
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

    override fun getTypedExportedConstants(): MutableMap<String, Any> {
        val constants: MutableMap<String, Any> = HashMap()
        val externalDirectory = this.reactApplicationContext.getExternalFilesDir(null)
        if (externalDirectory != null) {
            constants["ExternalDirectoryPath"] = externalDirectory.absolutePath
        }
        val externalCachesDirectory = this.reactApplicationContext.externalCacheDir
        if (externalCachesDirectory != null) {
            constants["ExternalCachesDirectoryPath"] = externalCachesDirectory.absolutePath
        }
        return constants
    }

    override fun invalidate() {
        reactApplicationContext.removeActivityEventListener(activityEventListener)
        pendingDocumentPromise?.reject("ECANCELLED", "Native file module invalidated")
        pendingDocumentPromise = null
        coroutineScope.cancel()
        super.invalidate()
    }

    companion object {
        private const val CREATE_DOCUMENT_REQUEST = 48120
        private const val PICK_DOCUMENT_REQUEST = 48121
    }
}
