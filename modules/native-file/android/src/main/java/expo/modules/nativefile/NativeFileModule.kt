package expo.modules.nativefile

import android.net.Uri
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Headers
import okhttp3.JavaNetCookieJar
import okhttp3.OkHttpClient
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


class NativeFileModule : Module() {
  private val BUFFER_SIZE = 4096
  private val okHttpClient: OkHttpClient = OkHttpClient.Builder()
    .cookieJar(JavaNetCookieJar(java.net.CookieManager()))
    .build()

  private fun getFileUri(filepath: String, appContext: expo.modules.kotlin.AppContext): Uri {
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

  private fun getInputStream(filepath: String, appContext: expo.modules.kotlin.AppContext): InputStream {
    val uri = getFileUri(filepath, appContext)
    return appContext.reactContext?.contentResolver?.openInputStream(uri)
      ?: throw Exception("ENOENT: could not open an input stream for '$filepath'")
  }

  private val writeAccessByAPILevel: String
    get() = if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) "w" else "rwt"

  private fun getOutputStream(filepath: String, appContext: expo.modules.kotlin.AppContext): OutputStream {
    val uri = getFileUri(filepath, appContext)
    return appContext.reactContext?.contentResolver?.openOutputStream(uri, writeAccessByAPILevel)
      ?: throw Exception("ENOENT: could not open an output stream for '$filepath'")
  }

  private fun copyFileContent(
    filepath: String,
    destPath: String,
    appContext: expo.modules.kotlin.AppContext,
    onDone: (() -> Unit)? = null,
  ) {
    try {
      val inputStream = getInputStream(filepath, appContext)
      try {
        val outputStream = getOutputStream(destPath, appContext)
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
      onDone?.invoke()
    } catch (e: IOException) {
      throw Exception("Failed to copy file from '$filepath' to '$destPath': ${e.message}")
    }
  }

  private fun deleteRecursive(fileOrDirectory: File) {
    if (fileOrDirectory.isDirectory) {
      fileOrDirectory.listFiles()?.forEach { child ->
        deleteRecursive(child)
      }
    }
    fileOrDirectory.delete()
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

  override fun definition() = ModuleDefinition {
    Name("NativeFile")

    Function("writeFile") { path: String, content: String ->
      try {
        val fw = FileWriter(path)
        fw.write(content)
        fw.close()
      } catch (e: IOException) {
        throw Exception("Failed to write file '$path': ${e.message}")
      }
    }

    Function("readFile") { path: String ->
      val file = File(path)
      if (!file.exists()) {
        throw Exception("File not found: '$path'")
      }
      file.bufferedReader().readText()
    }

    Function("copyFile") { sourcePath: String, destPath: String ->
      copyFileContent(sourcePath, destPath, appContext)
    }

    Function("moveFile") { sourcePath: String, destPath: String ->
      val inFile = File(sourcePath)
      copyFileContent(sourcePath, destPath, appContext) { inFile.delete() }
    }

    Function("exists") { filePath: String ->
      File(filePath).exists()
    }

    Function("mkdir") { filePath: String ->
      val file = File(filePath)
      if (!file.exists()) {
        val created = file.mkdirs()
        if (!created) throw Exception("Directory could not be created")
      }
    }

    Function("unlink") { filePath: String ->
      val file = File(filePath)
      if (file.exists()) {
        deleteRecursive(file)
      }
    }

    Function("readDir") { dirPath: String ->
      val file = File(dirPath)
      if (!file.exists()) throw Exception("Folder does not exist")
      val files = file.listFiles() ?: throw Exception("Cannot list directory")
      files.map { childFile ->
        mapOf(
          "name" to childFile.name,
          "path" to childFile.absolutePath,
          "isDirectory" to childFile.isDirectory
        )
      }
    }

    AsyncFunction("downloadFile") { url: String, destPath: String, method: String, headers: Map<String, String>, body: String?, promise: Promise ->
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
              promise.reject("DOWNLOAD_FAILED", e.message ?: "Download failed", e)
            }

            override fun onResponse(call: Call, response: Response) {
              response.use {
                if (!it.isSuccessful || it.body == null) {
                  promise.reject("DOWNLOAD_FAILED", "Failed to download: ${it.code}", Exception("HTTP ${it.code}"))
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
                  promise.reject("DOWNLOAD_FAILED", e.message ?: "Download error", e)
                }
              }
            }
          })
      } catch (e: Exception) {
        promise.reject("DOWNLOAD_FAILED", e.message ?: "Download error", e)
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


}
