package expo.modules.nativefile

import android.content.ContentResolver
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.webkit.MimeTypeMap
import java.io.FileNotFoundException
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream

internal class SafDocumentStore(private val context: Context) {
    private val resolver: ContentResolver
        get() = context.contentResolver

    fun readText(path: String): String =
        openInputStream(path).bufferedReader().use { it.readText() }

    fun writeText(path: String, content: String) {
        openOutputStream(path).bufferedWriter().use { it.write(content) }
    }

    fun openInputStream(path: String): InputStream {
        val uri = resolveExistingDocument(path)
        return resolver.openInputStream(uri)
            ?: throw FileNotFoundException("Could not open '$path' for reading")
    }

    fun openOutputStream(path: String): OutputStream {
        val uri = resolveOrCreateFile(path)
        val mode = if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) "w" else "rwt"
        return resolver.openOutputStream(uri, mode)
            ?: throw FileNotFoundException("Could not open '$path' for writing")
    }

    fun exists(path: String): Boolean = try {
        resolveExistingDocument(path)
        true
    } catch (_: Exception) {
        false
    }

    fun mkdir(path: String) {
        val virtualPath = parseVirtualTreePath(path)
        if (virtualPath == null) {
            val uri = Uri.parse(path)
            val stat = queryDocument(uri)
                ?: throw FileNotFoundException("Directory does not exist: '$path'")
            if (!stat.isDirectory) {
                throw IOException("A file already exists at the directory path: '$path'")
            }
            return
        }

        traverseVirtualPath(
            virtualPath,
            createMissingDirectories = true,
            requireDirectory = true,
        )
    }

    fun unlink(path: String) {
        val uri = try {
            resolveExistingDocument(path)
        } catch (_: FileNotFoundException) {
            return
        }
        if (!DocumentsContract.deleteDocument(resolver, uri)) {
            throw IOException("Could not delete '$path'")
        }
    }

    fun list(path: String): List<Map<String, Any>> {
        val directoryUri = resolveExistingDocument(path)
        val directory = queryDocument(directoryUri)
            ?: throw FileNotFoundException("Directory does not exist: '$path'")
        if (!directory.isDirectory) {
            throw IOException("Path is not a directory: '$path'")
        }

        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
            directoryUri,
            documentId(directoryUri),
        )
        resolver.query(childrenUri, DOCUMENT_PROJECTION, null, null, null)?.use { cursor ->
            val entries = mutableListOf<Map<String, Any>>()
            while (cursor.moveToNext()) {
                val child = documentFromCursor(cursor, directoryUri)
                entries += mapOf(
                    "name" to child.name,
                    "path" to child.uri.toString(),
                    "isDirectory" to child.isDirectory,
                )
            }
            return entries
        }
        return emptyList()
    }

    fun resolveUri(path: String): String = resolveExistingDocument(path).toString()

    private fun resolveOrCreateFile(path: String): Uri {
        try {
            val existing = resolveExistingDocument(path)
            val stat = queryDocument(existing)
                ?: throw FileNotFoundException("File does not exist: '$path'")
            if (stat.isDirectory) {
                throw IOException("Cannot write to directory '$path'")
            }
            return existing
        } catch (_: FileNotFoundException) {
            val virtualPath = parseVirtualTreePath(path)
                ?: throw FileNotFoundException("Cannot create document at '$path'")
            if (virtualPath.relativeSegments.isEmpty()) {
                throw IOException("Cannot create a file without a name: '$path'")
            }

            val fileName = virtualPath.relativeSegments.last()
            val parentPath = virtualPath.copy(
                relativeSegments = virtualPath.relativeSegments.dropLast(1),
            )
            val parentUri = traverseVirtualPath(
                parentPath,
                createMissingDirectories = true,
                requireDirectory = true,
            )
            return DocumentsContract.createDocument(
                resolver,
                parentUri,
                mimeTypeFor(fileName),
                fileName,
            ) ?: throw IOException("Could not create '$path'")
        }
    }

    private fun resolveExistingDocument(path: String): Uri {
        val uri = Uri.parse(path)
        if (uri.scheme != ContentResolver.SCHEME_CONTENT) {
            throw IOException("Not a Storage Access Framework URI: '$path'")
        }

        val virtualPath = parseVirtualTreePath(path)
        if (virtualPath != null) {
            return traverseVirtualPath(
                virtualPath,
                createMissingDirectories = false,
                requireDirectory = false,
            )
        }
        if (queryDocument(uri) == null) {
            throw FileNotFoundException("Document does not exist: '$path'")
        }
        return uri
    }

    private fun traverseVirtualPath(
        path: VirtualTreePath,
        createMissingDirectories: Boolean,
        requireDirectory: Boolean,
    ): Uri {
        var currentUri = DocumentsContract.buildDocumentUriUsingTree(
            path.treeUri,
            path.treeDocumentId,
        )
        if (queryDocument(currentUri) == null) {
            throw FileNotFoundException("Directory does not exist: '${path.treeUri}'")
        }

        for ((index, segment) in path.relativeSegments.withIndex()) {
            val child = findChild(currentUri, segment)
            if (child != null) {
                val isLastSegment = index == path.relativeSegments.lastIndex
                if (!child.isDirectory && (!isLastSegment || requireDirectory)) {
                    throw IOException("Cannot traverse through file '${child.name}'")
                }
                currentUri = child.uri
                continue
            }
            if (!createMissingDirectories) {
                throw FileNotFoundException("Document '$segment' does not exist")
            }
            currentUri = DocumentsContract.createDocument(
                resolver,
                currentUri,
                DocumentsContract.Document.MIME_TYPE_DIR,
                segment,
            ) ?: throw IOException("Could not create directory '$segment'")
        }
        return currentUri
    }

    private fun findChild(parentUri: Uri, displayName: String): SafDocument? {
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
            parentUri,
            documentId(parentUri),
        )
        resolver.query(childrenUri, DOCUMENT_PROJECTION, null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                val child = documentFromCursor(cursor, parentUri)
                if (child.name == displayName) return child
            }
        }
        return null
    }

    private fun queryDocument(uri: Uri): SafDocument? {
        resolver.query(uri, DOCUMENT_PROJECTION, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) return documentFromCursor(cursor, uri)
        }
        return null
    }

    private fun documentFromCursor(cursor: Cursor, treeUri: Uri): SafDocument {
        val documentId = cursor.getString(0)
        val uri = if (DocumentsContract.isTreeUri(treeUri)) {
            DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
        } else {
            treeUri
        }
        val mimeType = cursor.getString(2)
        return SafDocument(
            uri = uri,
            name = cursor.getString(1),
            isDirectory = mimeType == DocumentsContract.Document.MIME_TYPE_DIR,
        )
    }

    private fun documentId(uri: Uri): String =
        if (DocumentsContract.isDocumentUri(context, uri)) {
            DocumentsContract.getDocumentId(uri)
        } else {
            DocumentsContract.getTreeDocumentId(uri)
        }

    private fun parseVirtualTreePath(path: String): VirtualTreePath? {
        val uri = Uri.parse(path)
        if (
            uri.scheme != ContentResolver.SCHEME_CONTENT ||
            DocumentsContract.isDocumentUri(context, uri)
        ) {
            return null
        }
        val segments = uri.pathSegments
        if (segments.size < 2 || segments[0] != TREE_PATH_SEGMENT) return null

        val treeDocumentId = segments[1]
        val treeUri = DocumentsContract.buildTreeDocumentUri(uri.authority, treeDocumentId)
        return VirtualTreePath(
            treeUri = treeUri,
            treeDocumentId = treeDocumentId,
            relativeSegments = segments.drop(2).filter(String::isNotEmpty),
        )
    }

    private fun mimeTypeFor(fileName: String): String {
        val extension = fileName.substringAfterLast('.', missingDelimiterValue = "")
        if (extension.isEmpty()) return "application/octet-stream"
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension.lowercase())
            ?: "application/octet-stream"
    }

    private data class VirtualTreePath(
        val treeUri: Uri,
        val treeDocumentId: String,
        val relativeSegments: List<String>,
    )

    private data class SafDocument(
        val uri: Uri,
        val name: String,
        val isDirectory: Boolean,
    )

    private companion object {
        const val TREE_PATH_SEGMENT = "tree"

        val DOCUMENT_PROJECTION = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
        )
    }
}
