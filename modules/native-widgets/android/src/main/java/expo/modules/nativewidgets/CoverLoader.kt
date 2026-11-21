package expo.modules.nativewidgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.net.Uri
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Loads novel covers for widgets. Covers are center-cropped to 2:3 and scaled
 * down before they go anywhere near RemoteViews: every bitmap is parceled to
 * the launcher, and oversized ones fail the whole update.
 */
internal object CoverLoader {
    enum class Size(val width: Int, val height: Int) {
        HERO(300, 450),
        THUMB(108, 162),
    }

    private const val CACHE_DIR = "lnreader_widget_covers"
    private const val MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024
    private const val MAX_CACHE_FILES = 120
    private const val USER_AGENT =
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"

    fun load(context: Context, uri: String, size: Size): Bitmap? {
        val cacheFile = File(cacheDir(context), "${sha1(uri)}_${size.name.lowercase()}.jpg")
        if (cacheFile.exists()) {
            BitmapFactory.decodeFile(cacheFile.path)?.let {
                cacheFile.setLastModified(System.currentTimeMillis())
                return it
            }
        }

        val bytes = try {
            readSource(context, uri)
        } catch (_: Exception) {
            null
        } ?: return null

        val bitmap = decodeCropped(bytes, size) ?: return null
        try {
            cacheFile.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 88, it) }
            pruneCache(context)
        } catch (_: Exception) {
            cacheFile.delete()
        }
        return bitmap
    }

    private fun readSource(context: Context, uri: String): ByteArray? {
        return when {
            uri.startsWith("http://") || uri.startsWith("https://") -> download(uri)
            uri.startsWith("content://") ->
                context.contentResolver.openInputStream(Uri.parse(uri))?.use { it.readLimited() }
            uri.startsWith("file://") -> Uri.parse(uri).path?.let { File(it).readLimitedOrNull() }
            uri.startsWith("/") -> File(uri).readLimitedOrNull()
            else -> null
        }
    }

    private fun download(url: String): ByteArray? {
        val connection = URL(url).openConnection() as HttpURLConnection
        return try {
            connection.connectTimeout = 8_000
            connection.readTimeout = 12_000
            connection.instanceFollowRedirects = true
            connection.setRequestProperty("User-Agent", USER_AGENT)
            connection.setRequestProperty("Accept", "image/avif,image/webp,image/*,*/*;q=0.8")
            if (connection.responseCode !in 200..299) return null
            connection.inputStream.use { it.readLimited() }
        } finally {
            connection.disconnect()
        }
    }

    private fun decodeCropped(bytes: ByteArray, size: Size): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        var sample = 1
        while (bounds.outWidth / (sample * 2) >= size.width && bounds.outHeight / (sample * 2) >= size.height) {
            sample *= 2
        }
        val source = BitmapFactory.decodeByteArray(
            bytes,
            0,
            bytes.size,
            BitmapFactory.Options().apply { inSampleSize = sample },
        ) ?: return null

        // Center-crop to 2:3; never stretch.
        val targetRatio = size.width.toFloat() / size.height
        val sourceRatio = source.width.toFloat() / source.height
        val crop = if (sourceRatio > targetRatio) {
            val w = (source.height * targetRatio).toInt()
            val left = (source.width - w) / 2
            Rect(left, 0, left + w, source.height)
        } else {
            val h = (source.width / targetRatio).toInt()
            val top = (source.height - h) / 2
            Rect(0, top, source.width, top + h)
        }
        val output = Bitmap.createBitmap(size.width, size.height, Bitmap.Config.ARGB_8888)
        Canvas(output).drawBitmap(
            source,
            crop,
            Rect(0, 0, size.width, size.height),
            Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG),
        )
        if (source !== output) source.recycle()
        return output
    }

    private fun pruneCache(context: Context) {
        val files = cacheDir(context).listFiles() ?: return
        if (files.size <= MAX_CACHE_FILES) return
        files.sortedBy { it.lastModified() }
            .take(files.size - MAX_CACHE_FILES)
            .forEach { it.delete() }
    }

    private fun cacheDir(context: Context): File =
        File(context.cacheDir, CACHE_DIR).apply { mkdirs() }

    private fun sha1(value: String): String =
        MessageDigest.getInstance("SHA-1").digest(value.toByteArray())
            .joinToString("") { "%02x".format(it) }

    private fun File.readLimitedOrNull(): ByteArray? =
        if (exists() && length() in 1..MAX_DOWNLOAD_BYTES) readBytes() else null

    private fun InputStream.readLimited(): ByteArray? {
        val buffer = java.io.ByteArrayOutputStream()
        val chunk = ByteArray(16 * 1024)
        var total = 0
        while (true) {
            val read = read(chunk)
            if (read < 0) break
            total += read
            if (total > MAX_DOWNLOAD_BYTES) return null
            buffer.write(chunk, 0, read)
        }
        return buffer.toByteArray()
    }
}
