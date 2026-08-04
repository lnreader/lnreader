package expo.modules.nativefile

import android.app.Activity
import android.content.ContentResolver
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.network.CookieJarContainer
import com.facebook.react.modules.network.ForwardingCookieHandler
import com.facebook.react.modules.network.OkHttpClientProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
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
import java.util.UUID
import java.io.PushbackInputStream
import java.util.zip.GZIPInputStream
import kotlin.coroutines.coroutineContext

class NativeFileModule : Module() {
    private val BUFFER_SIZE = 4096
    private val okHttpClient = OkHttpClientProvider.createClient()
    private val coroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var pendingDocumentPromise: Promise? = null

    private val reactContext: ReactApplicationContext?
        get() = appContext.reactContext as? ReactApplicationContext

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (
                requestCode != CREATE_DOCUMENT_REQUEST &&
                requestCode != PICK_DOCUMENT_REQUEST &&
                requestCode != PICK_DIRECTORY_REQUEST
            ) return
            val promise = pendingDocumentPromise ?: return
            pendingDocumentPromise = null
            val uri = data?.data
            if (resultCode != Activity.RESULT_OK || uri == null) {
                promise.reject("ECANCELLED", "Document selection was cancelled", null)
                return
            }
            try {
                val flags = data.flags and
                    (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                reactContext?.contentResolver?.takePersistableUriPermission(uri, flags)
            } catch (_: SecurityException) {
                // Some providers do not support persisted grants.
            }
            if (requestCode == PICK_DIRECTORY_REQUEST) {
                val documentId = try {
                    DocumentsContract.getTreeDocumentId(uri)
                } catch (_: IllegalArgumentException) {
                    uri.lastPathSegment.orEmpty()
                }
                promise.resolve(
                    mapOf(
                        "uri" to uri.toString(),
                        "name" to documentId
                            .substringAfterLast(':')
                            .substringAfterLast('/')
                            .ifEmpty { "Selected folder" },
                    ),
                )
            } else {
                promise.resolve(uri.toString())
            }
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
        return reactContext?.contentResolver?.openInputStream(uri)
            ?: throw Exception("ENOENT: could not open an input stream for '$filepath'")
    }

    private val writeAccessByAPILevel: String
        get() = if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) "w" else "rwt"

    private fun getOutputStream(filepath: String): OutputStream {
        val uri = getFileUri(filepath)
        return reactContext?.contentResolver?.openOutputStream(uri, writeAccessByAPILevel)
            ?: throw Exception("ENOENT: could not open an output stream for '$filepath'")
    }

    private suspend fun copyFileContent(
        filepath: String,
        destPath: String,
        onDone: (() -> Unit)? = null,
    ): Long {
        try {
            val inputStream = getInputStream(filepath)
            var copiedBytes = 0L
            try {
                val outputStream = getOutputStream(destPath)
                try {
                    val buffer = ByteArray(BUFFER_SIZE)
                    var length: Int
                    while (inputStream.read(buffer).also { length = it } > 0) {
                        coroutineContext.ensureActive()
                        outputStream.write(buffer, 0, length)
                        copiedBytes += length
                    }
                    outputStream.flush()
                } finally {
                    outputStream.close()
                }
            } finally {
                inputStream.close()
            }
            if (onDone != null) {
                onDone()
            }
            return copiedBytes
        } catch (e: IOException) {
            throw Exception("Failed to copy file from '$filepath' to '$destPath': ${e.message}")
        }
    }

    private fun contentResolver(): ContentResolver =
        reactContext?.contentResolver
            ?: throw IOException("React context is unavailable")

    private suspend fun copyToOutputStream(sourcePath: String, outputStream: OutputStream): Long {
        var copiedBytes = 0L
        getInputStream(sourcePath).use { inputStream ->
            outputStream.use { output ->
                val buffer = ByteArray(BUFFER_SIZE)
                var length: Int
                while (inputStream.read(buffer).also { length = it } > 0) {
                    coroutineContext.ensureActive()
                    output.write(buffer, 0, length)
                    copiedBytes += length
                }
                output.flush()
            }
        }
        return copiedBytes
    }

    private fun resolveDirectoryFile(directoryUri: String): File {
        val uri = Uri.parse(directoryUri)
        val directory = if (uri.scheme == null) {
            File(directoryUri)
        } else if (uri.scheme == ContentResolver.SCHEME_FILE) {
            File(uri.path ?: throw IOException("Invalid directory URI: '$directoryUri'"))
        } else {
            throw IOException("Unsupported filesystem directory URI: '$directoryUri'")
        }
        if (!directory.isDirectory) {
            throw IOException("Destination directory does not exist: '$directoryUri'")
        }
        return directory
    }

    private suspend fun copyFileToFilesystemDirectory(
        sourcePath: String,
        directoryUri: String,
        fileName: String,
        replace: Boolean,
    ): Map<String, Any> {
        val directory = resolveDirectoryFile(directoryUri)
        val destination = File(directory, fileName)
        if (destination.exists() && !replace) {
            throw IOException("File already exists: ${destination.absolutePath}")
        }

        val staging = File(directory, ".$fileName.${UUID.randomUUID()}.tmp")
        val backup = File(directory, ".$fileName.${UUID.randomUUID()}.bak")
        try {
            val copiedBytes = FileOutputStream(staging).use { output ->
                copyToOutputStream(sourcePath, output)
            }
            if (staging.length() != copiedBytes) {
                throw IOException("Copied file size does not match the source stream")
            }

            val hadDestination = destination.exists()
            if (hadDestination && !destination.renameTo(backup)) {
                throw IOException("Could not stage the existing destination for replacement")
            }
            if (!staging.renameTo(destination)) {
                if (hadDestination) {
                    backup.renameTo(destination)
                }
                throw IOException("Could not move the completed copy into the destination")
            }
            if (backup.exists() && !backup.delete()) {
                throw IOException("Could not remove the replaced destination backup")
            }
            return mapOf("uri" to destination.absolutePath, "size" to copiedBytes)
        } finally {
            staging.delete()
            if (backup.exists() && !destination.exists()) {
                backup.renameTo(destination)
            }
        }
    }

    private fun resolveTreeDirectoryUri(treeUri: Uri): Uri {
        if (!DocumentsContract.isTreeUri(treeUri)) {
            throw IOException("Destination is not a Storage Access Framework directory: '$treeUri'")
        }
        val documentId = DocumentsContract.getTreeDocumentId(treeUri)
        return DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
    }

    private fun findChildDocument(treeUri: Uri, directoryUri: Uri, fileName: String): Uri? {
        val resolver = contentResolver()
        val documentId = DocumentsContract.getDocumentId(directoryUri)
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, documentId)
        val projection = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        )
        resolver.query(childrenUri, projection, null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                if (cursor.getString(1) == fileName) {
                    return DocumentsContract.buildDocumentUriUsingTree(treeUri, cursor.getString(0))
                }
            }
        }
        return null
    }

    private fun renameDocument(documentUri: Uri, displayName: String): Uri =
        DocumentsContract.renameDocument(contentResolver(), documentUri, displayName)
            ?: throw IOException("Could not rename destination document to '$displayName'")

    private suspend fun copyFileToSafDirectory(
        sourcePath: String,
        directoryUriString: String,
        fileName: String,
        mimeType: String,
        replace: Boolean,
    ): Map<String, Any> {
        val resolver = contentResolver()
        val treeUri = Uri.parse(directoryUriString)
        val directoryUri = resolveTreeDirectoryUri(treeUri)
        val existing = findChildDocument(treeUri, directoryUri, fileName)
        if (existing != null && !replace) {
            throw IOException("File already exists: $fileName")
        }

        val token = UUID.randomUUID().toString()
        val stagingName = "$fileName.lnreader-$token.tmp"
        val backupName = "$fileName.lnreader-$token.bak"
        var stagingUri = DocumentsContract.createDocument(
            resolver,
            directoryUri,
            mimeType,
            stagingName,
        ) ?: throw IOException("Could not create a temporary destination document")
        var backupUri: Uri? = null
        var completedUri: Uri? = null

        try {
            val copiedBytes = copyToOutputStream(
                sourcePath,
                resolver.openOutputStream(stagingUri, writeAccessByAPILevel)
                    ?: throw IOException("Could not open the temporary destination document"),
            )

            if (existing != null) {
                backupUri = renameDocument(existing, backupName)
            }
            try {
                completedUri = renameDocument(stagingUri, fileName)
                stagingUri = completedUri
            } catch (error: Exception) {
                backupUri?.let {
                    try {
                        renameDocument(it, fileName)
                        backupUri = null
                    } catch (_: Exception) {
                        // Keep the original replacement error.
                    }
                }
                throw error
            }

            backupUri?.let {
                try {
                    DocumentsContract.deleteDocument(resolver, it)
                } catch (_: Exception) {
                    // The completed destination is already in place.
                }
                backupUri = null
            }
            return mapOf("uri" to completedUri.toString(), "size" to copiedBytes)
        } finally {
            if (completedUri == null) {
                try {
                    DocumentsContract.deleteDocument(resolver, stagingUri)
                } catch (_: Exception) {
                    // Preserve the original copy or replacement error.
                }
            }
            if (completedUri == null) backupUri?.let {
                try {
                    renameDocument(it, fileName)
                } catch (_: Exception) {
                    // Preserve the original copy or replacement error.
                }
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
            val ctx = reactContext ?: return@OnCreate
            val cookieContainer = okHttpClient.cookieJar as CookieJarContainer
            val cookieHandler = ForwardingCookieHandler(ctx)
            cookieContainer.setCookieJar(JavaNetCookieJar(cookieHandler))
            ctx.addActivityEventListener(activityEventListener)
        }

        OnDestroy {
            reactContext?.removeActivityEventListener(activityEventListener)
            pendingDocumentPromise?.reject("ECANCELLED", "Native file module invalidated", null)
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

        AsyncFunction("pickDirectory") { promise: Promise ->
            launchDocumentIntent(
                Intent(Intent.ACTION_OPEN_DOCUMENT_TREE),
                PICK_DIRECTORY_REQUEST,
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
                        promise.reject("ENOENT", "File not found: '$path'", null)
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

        AsyncFunction("copyFileToDirectory") { sourcePath: String, directoryUri: String, fileName: String, mimeType: String, replace: Boolean, promise: Promise ->
            coroutineScope.launch {
                try {
                    require(fileName.isNotBlank() && fileName != "." && fileName != ".." && !fileName.contains('/') && !fileName.contains('\\')) {
                        "Invalid destination file name"
                    }
                    val uri = Uri.parse(directoryUri)
                    val result = if (uri.scheme == ContentResolver.SCHEME_CONTENT) {
                        copyFileToSafDirectory(sourcePath, directoryUri, fileName, mimeType, replace)
                    } else {
                        copyFileToFilesystemDirectory(sourcePath, directoryUri, fileName, replace)
                    }
                    promise.resolve(result)
                } catch (e: Exception) {
                    rejectFileOperation(promise, "copy into directory", directoryUri, e)
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
                    if (file.exists() && !file.isDirectory) {
                        throw IOException("A file already exists at the directory path")
                    }
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
                        promise.reject("ENOENT", "Folder does not exist: '$directory'", null)
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
        }

        Constant("DocumentDirectoryPath") {
            val context = reactContext ?: appContext.currentActivity
            context?.filesDir?.absolutePath.orEmpty()
        }

        Constant("ExternalDirectoryPath") {
            val context = reactContext ?: appContext.currentActivity
            val directory = context?.getExternalFilesDir(null) ?: context?.filesDir
            directory?.absolutePath.orEmpty()
        }

        Constant("ExternalCachesDirectoryPath") {
            val context = reactContext ?: appContext.currentActivity
            val directory = context?.externalCacheDir ?: context?.cacheDir
            directory?.absolutePath.orEmpty()
        }
    }

    private fun launchDocumentIntent(intent: Intent, requestCode: Int, promise: Promise) {
        val activity = appContext.currentActivity
        if (activity == null) {
            promise.reject("ENOACTIVITY", "A visible activity is required to select a document", null)
            return
        }
        if (pendingDocumentPromise != null) {
            promise.reject("EBUSY", "Another document selection is already active", null)
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
        private const val PICK_DIRECTORY_REQUEST = 48122
    }
}
