package expo.modules.nativeziparchive

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

class NativeZipArchiveModule : Module() {
  private fun zipProcess(
    sourceDirPath: String,
    zos: ZipOutputStream,
    archivePrefix: String = "",
    archiveEntries: MutableSet<String>? = null,
    excludedFile: File? = null,
  ) {
    val sourceDir = File(sourceDirPath)
    val excludedCanonicalPath = excludedFile?.canonicalPath
    sourceDir.walkBottomUp().filter { file ->
      file.isFile && file.canonicalPath != excludedCanonicalPath
    }.forEach { file ->
      val relativePath =
        file.absolutePath.removePrefix(sourceDir.absolutePath).removePrefix("/")
      val zipFileName = joinArchivePath(archivePrefix, relativePath)
      if (archiveEntries != null && !archiveEntries.add(zipFileName)) {
        throw IllegalArgumentException("Duplicate ZIP entry: $zipFileName")
      }
      val entry = ZipEntry("$zipFileName${(if (file.isDirectory) "/" else "")}")
      zos.putNextEntry(entry)
      file.inputStream().use { fis ->
        fis.copyTo(zos, COPY_BUFFER_SIZE)
      }
    }
  }

  private fun joinArchivePath(prefix: String, relativePath: String): String {
    val normalizedRelativePath = relativePath.replace('\\', '/').trimStart('/')
    return if (prefix.isEmpty()) {
      normalizedRelativePath
    } else {
      "$prefix/$normalizedRelativePath"
    }
  }

  private fun normalizeArchivePrefix(prefix: String): String {
    require(prefix.isEmpty() || prefix.isNotBlank()) { "ZIP prefix must not be blank" }
    val normalized = prefix.replace('\\', '/')
    require(!normalized.startsWith("/") && !(normalized.length >= 2 && normalized[1] == ':')) {
      "ZIP prefix must be relative"
    }
    val components = normalized.split('/').filter { it.isNotEmpty() && it != "." }
    require(components.none { it == ".." }) { "ZIP prefix must not contain .." }
    return components.joinToString("/")
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

    AsyncFunction("zip") { sourceDirPath: String, zipFilePath: String, promise: Promise ->
      Thread {
        try {
          FileOutputStream(zipFilePath).use { fos ->
            ZipOutputStream(fos).use { zos -> zipProcess(sourceDirPath, zos, excludedFile = File(zipFilePath)) }
          }
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("ZIP_FAILED", e.message ?: "Zip failed", e)
        }
      }.start()
    }

    AsyncFunction("zipDirectories") { sources: List<Map<String, String>>, zipFilePath: String, promise: Promise ->
      Thread {
        try {
          require(sources.isNotEmpty()) { "ZIP sources must not be empty" }
          require(zipFilePath.isNotBlank()) { "ZIP file path must not be blank" }
          val normalizedSources = sources.map { source ->
            val sourceDirPath =
              source["path"]?.takeIf { it.isNotBlank() }
                ?: throw IllegalArgumentException("ZIP source path must not be blank")
            require(File(sourceDirPath).isDirectory) {
              "ZIP source path is not a directory: $sourceDirPath"
            }
            val archivePrefix =
              source["prefix"]?.let(::normalizeArchivePrefix)
                ?: throw IllegalArgumentException("ZIP source prefix is missing")
            sourceDirPath to archivePrefix
          }
          val archiveEntries = mutableSetOf<String>()
          FileOutputStream(zipFilePath).use { fos ->
            ZipOutputStream(fos).use { zos ->
              normalizedSources.forEach { (sourceDirPath, archivePrefix) ->
                zipProcess(sourceDirPath, zos, archivePrefix, archiveEntries, File(zipFilePath))
              }
            }
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
  }

}
