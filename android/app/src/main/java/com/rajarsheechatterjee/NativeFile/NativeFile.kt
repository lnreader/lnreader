package com.rajarsheechatterjee.NativeFile

import android.net.Uri
import android.os.Build
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
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


class NativeFile(context: ReactApplicationContext) :
    NativeFileSpec(context) {
    private val BUFFER_SIZE = 4096
    private val okHttpClient = OkHttpClientProvider.createClient()
    private val coroutineScope = CoroutineScope(Dispatchers.IO)

    init {
        val cookieContainer = okHttpClient.cookieJar as CookieJarContainer
        val cookieHandler = ForwardingCookieHandler(reactApplicationContext)
        cookieContainer.setCookieJar(JavaNetCookieJar(cookieHandler))
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

    override fun writeFile(path: String, content: String) {
        try {
            val fw = FileWriter(path)
            fw.write(content)
            fw.close()
        } catch (e: IOException) {
            throw Exception("Failed to write file '$path': ${e.message}")
        }
    }

    override fun readFile(path: String): String {
        val file = File(path)
        if (!file.exists()) {
            throw Exception("File not found: '$path'")
        }
        return file.bufferedReader().readText()
    }

    override fun copyFile(filepath: String, destPath: String) {
        copyFileContent(filepath, destPath)
    }

    override fun moveFile(filepath: String, destPath: String) {
        val inFile = File(filepath)
        copyFileContent(filepath, destPath, { inFile.delete() })
    }

    private fun copyFileContent(
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

    override fun exists(filepath: String) = File(filepath).exists()

    override fun mkdir(filepath: String) {
        val file = File(filepath)
        if (!file.exists()) {
            val created = file.mkdirs()
            if (!created) throw Exception("Directory could not be created")
        }
    }

    private fun deleteRecursive(fileOrDirectory: File) {
        if (fileOrDirectory.isDirectory) {
            for (child in fileOrDirectory.listFiles()!!) {
                deleteRecursive(child)
            }
        }
        fileOrDirectory.delete()
    }

    override fun unlink(filepath: String) {
        val file = File(filepath)
        if (!file.exists()) return
        deleteRecursive(file)
    }

    override fun readDir(directory: String): WritableArray {
        val file = File(directory)
        if (!file.exists()) throw Exception("Folder does not exist")
        val files = file.listFiles()
        val fileMaps: WritableArray = WritableNativeArray()
        for (childFile in files!!) {
            val fileMap: WritableMap = WritableNativeMap()
            fileMap.putString("name", childFile.name)
            fileMap.putString("path", childFile.absolutePath)
            fileMap.putBoolean("isDirectory", childFile.isDirectory)
            fileMaps.pushMap(fileMap)
        }
        return fileMaps
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
}
