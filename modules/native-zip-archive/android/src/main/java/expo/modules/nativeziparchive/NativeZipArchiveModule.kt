package expo.modules.nativeziparchive

import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

class NativeZipArchiveModule : Module() {
  private fun zipProcess(sourceDirPath: String, zos: ZipOutputStream) {
    val sourceDir = File(sourceDirPath)
    sourceDir.walkBottomUp().filter { it.isFile }.forEach { file ->
      val zipFileName =
        file.absolutePath.removePrefix(sourceDir.absolutePath).removePrefix("/")
      val entry = ZipEntry("$zipFileName${(if (file.isDirectory) "/" else "")}")
      zos.putNextEntry(entry)
      file.inputStream().use { fis ->
        fis.copyTo(zos, COPY_BUFFER_SIZE)
      }
    }
  }

  // Reads one small entry without extracting the archive. Returns null when the
  // archive has no such entry; throws EntryTooLargeException above MAX_ENTRY_BYTES.
  private fun readZipEntry(sourcePath: String, entryName: String): String? {
    val uri = Uri.parse(sourcePath)
    if (uri.scheme == null) return readEntryFromFile(File(sourcePath), entryName)
    if (uri.scheme.equals("file", ignoreCase = true)) {
      return readEntryFromFile(File(uri.path ?: throw IOException("Invalid path")), entryName)
    }
    val resolver = appContext.reactContext?.contentResolver
      ?: throw IOException("React context is unavailable")
    // A seekable provider lets ZipFile jump to the central directory. Others
    // are streamed until the entry is found.
    try {
      resolver.openFileDescriptor(uri, "r")?.use { pfd ->
        return readEntryFromFile(File("/proc/self/fd/${pfd.fd}"), entryName)
      }
    } catch (e: Exception) {
      // Not seekable: fall back to streaming.
    }
    val stream = resolver.openInputStream(uri) ?: throw IOException("Could not open $sourcePath")
    return stream.use { readEntryFromStream(it, entryName) }
  }

  private fun readEntryFromFile(file: File, entryName: String): String? =
    ZipFile(file).use { zip ->
      val entry = zip.getEntry(entryName) ?: return null
      zip.getInputStream(entry).use { readBounded(it) }
    }

  // The size in a zip header can be unknown or wrong, so the limit is applied
  // to the bytes actually inflated.
  private fun readBounded(input: InputStream): String {
    val buffer = java.io.ByteArrayOutputStream()
    val chunk = ByteArray(8 * 1024)
    while (buffer.size() <= MAX_ENTRY_BYTES) {
      val read = input.read(chunk, 0, minOf(chunk.size, MAX_ENTRY_BYTES + 1 - buffer.size()))
      if (read < 0) break
      buffer.write(chunk, 0, read)
    }
    if (buffer.size() > MAX_ENTRY_BYTES) throw EntryTooLargeException()
    return buffer.toString(Charsets.UTF_8.name())
  }

  private fun readEntryFromStream(input: InputStream, entryName: String): String? {
    ZipInputStream(input.buffered(COPY_BUFFER_SIZE)).use { zis ->
      while (true) {
        val entry = zis.nextEntry ?: return null
        if (entry.name == entryName) {
          return readBounded(zis)
        }
      }
    }
  }

  private fun ensureParentDirectory(file: File, createdDirectories: MutableSet<String>) {
    val parent = file.parentFile ?: return
    val parentPath = parent.absolutePath
    if (parentPath !in createdDirectories && (parent.exists() || parent.mkdirs())) {
      createdDirectories.add(parentPath)
    }
  }
  private fun resolveZipEntry(destination: File, entryName: String): File {
    val canonicalDestination = destination.canonicalFile
    val outputFile = File(destination, entryName).canonicalFile
    val destinationPath =
      canonicalDestination.path.let { if (it.endsWith(File.separator)) it else it + File.separator }
    require(outputFile.path.startsWith(destinationPath)) {
      "ZIP entry is outside the destination directory: $entryName"
    }
    return outputFile
  }

  override fun definition() = ModuleDefinition {
    Name("NativeZipArchive")

    AsyncFunction("unzip") { sourceFilePath: String, distDirPath: String, promise: Promise ->
      Thread {
        try {
          val createdDirectories = mutableSetOf<String>()
          ZipFile(sourceFilePath).use { zis ->
            zis.entries().asSequence().filterNot { it.isDirectory }.forEach { zipEntry ->
              val newFile = resolveZipEntry(File(distDirPath), zipEntry.name)
              ensureParentDirectory(newFile, createdDirectories)
              zis.getInputStream(zipEntry).use { inputStream ->
                FileOutputStream(newFile).use { fos -> inputStream.copyTo(fos, COPY_BUFFER_SIZE) }
              }
            }
          }
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("UNZIP_FAILED", e.message ?: "Unzip failed", e)
        }
      }.start()
    }

    AsyncFunction("readEntry") { sourcePath: String, entryName: String, promise: Promise ->
      Thread {
        try {
          promise.resolve(readZipEntry(sourcePath, entryName))
        } catch (e: EntryTooLargeException) {
          promise.reject("ENTRY_TOO_LARGE", "Entry is too large", e)
        } catch (e: Exception) {
          promise.reject("READ_ENTRY_FAILED", e.message ?: "Read entry failed", e)
        }
      }.start()
    }

    AsyncFunction("zip") { sourceDirPath: String, zipFilePath: String, promise: Promise ->
      Thread {
        try {
          FileOutputStream(zipFilePath).use { fos ->
            ZipOutputStream(fos).use { zos -> zipProcess(sourceDirPath, zos) }
          }
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("ZIP_FAILED", e.message ?: "Zip failed", e)
        }
      }.start()
    }

    AsyncFunction("remoteUnzip") { distDirPath: String, urlString: String, headers: Map<String, String>, promise: Promise ->
      Thread {
        val connection = URL(urlString).openConnection() as HttpURLConnection
        try {
          connection.requestMethod = "GET"
          headers.forEach { (key, value) ->
            connection.setRequestProperty(key, value)
          }
          val createdDirectories = mutableSetOf<String>()
          ZipInputStream(connection.inputStream).use { zis ->
            generateSequence { zis.nextEntry }
              .filterNot { it.isDirectory }
              .forEach { zipEntry ->
                val newFile = resolveZipEntry(File(distDirPath), zipEntry.name)
                ensureParentDirectory(newFile, createdDirectories)
                FileOutputStream(newFile).use { fos -> zis.copyTo(fos, COPY_BUFFER_SIZE) }
              }
          }
          if (connection.responseCode == 200) {
            promise.resolve(null)
          } else {
            throw Exception("Network request failed")
          }
        } catch (e: Exception) {
          promise.reject("REMOTE_UNZIP_FAILED", e.message ?: "Remote unzip failed", e)
        } finally {
          connection.disconnect()
        }
      }.start()
    }

    AsyncFunction("remoteZip") { sourceDirPath: String, urlString: String, headers: Map<String, String>, promise: Promise ->
      Thread {
        val connection = URL(urlString).openConnection() as HttpURLConnection
        try {
          connection.requestMethod = "POST"
          headers.forEach { (key, value) ->
            connection.setRequestProperty(key, value)
          }
          ZipOutputStream(connection.outputStream).use { zipProcess(sourceDirPath, it) }
          if (connection.responseCode == 200) {
            promise.resolve(
              connection.inputStream.bufferedReader().use { it.readText() })
          } else {
            throw Exception("Network request failed")
          }
        } catch (e: Exception) {
          promise.reject("REMOTE_ZIP_FAILED", e.message ?: "Remote zip failed", e)
        } finally {
          connection.disconnect()
        }
      }.start()
    }
  }

  private companion object {
    const val COPY_BUFFER_SIZE = 64 * 1024
    const val MAX_ENTRY_BYTES = 1024 * 1024
  }

}

private class EntryTooLargeException : IOException("Entry is too large")
