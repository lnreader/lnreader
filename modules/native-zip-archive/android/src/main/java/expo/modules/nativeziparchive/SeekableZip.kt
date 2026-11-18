package expo.modules.nativeziparchive

import java.io.Closeable
import java.io.EOFException
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
import java.util.UUID
import java.util.zip.CRC32
import java.util.zip.Inflater
import java.util.zip.InflaterInputStream
import java.util.zip.ZipException

/**
 * Reads a zip archive through a file channel with positional reads, so entries
 * can be read in any order and from several threads at once. Unlike
 * java.util.zip.ZipFile it does not need a path: on Android 9 and older a file
 * picked through a document provider can only be read through the descriptor
 * the provider returns, because reopening it by /proc/self/fd is denied.
 */
internal class SeekableZip(
  private val channel: FileChannel,
  private val owner: Closeable,
) : Closeable {
  class Entry(
    val name: String,
    val isDirectory: Boolean,
    val method: Int,
    val compressedSize: Long,
    val size: Long,
    val crc: Long,
    val localHeaderOffset: Long,
  )

  val entries: List<Entry> = readCentralDirectory()

  override fun close() = owner.close()

  /**
   * The entry's data. Reading it fails with a ZipException as soon as it
   * inflates past the entry's size, and at its end if the length or CRC-32
   * differ from the central directory.
   */
  fun open(entry: Entry): InputStream = CheckedEntryInputStream(entry, openData(entry))

  /** Reads a whole entry; one larger than [maxBytes] fails before it is read. */
  fun readText(entry: Entry, maxBytes: Int): String {
    if (entry.size > maxBytes) {
      throw ZipException("${entry.name} is larger than $maxBytes bytes")
    }
    val bytes = ByteArray(entry.size.toInt())
    open(entry).use { input ->
      var offset = 0
      while (offset < bytes.size) {
        val count = input.read(bytes, offset, bytes.size - offset)
        if (count < 0) break
        offset += count
      }
      // Reaching the end runs the length and CRC-32 checks.
      input.read()
    }
    return String(bytes, Charsets.UTF_8)
  }

  /**
   * Writes an entry to [destination]. The destination can be an existing
   * library cover, so it is replaced only by a complete, verified copy.
   */
  fun extract(entry: Entry, destination: File) {
    val temporary = File(destination.parentFile, ".${destination.name}.${UUID.randomUUID()}.tmp")
    try {
      open(entry).use { input ->
        FileOutputStream(temporary).use { output -> input.copyTo(output, BUFFER_SIZE) }
      }
      if (!temporary.renameTo(destination)) {
        throw IOException("Could not replace ${destination.path}")
      }
    } finally {
      temporary.delete()
    }
  }

  private fun openData(entry: Entry): InputStream {
    val header = read(entry.localHeaderOffset, LOCAL_HEADER_SIZE)
    if (header.getInt(0) != LOCAL_HEADER_SIGNATURE) {
      throw ZipException("Invalid local header for ${entry.name}")
    }
    val dataOffset = entry.localHeaderOffset + LOCAL_HEADER_SIZE +
      header.u16(26) + header.u16(28)
    val raw = RegionInputStream(dataOffset, entry.compressedSize)
    return when (entry.method) {
      STORED -> raw
      DEFLATED -> EntryInflaterInputStream(raw)
      else -> throw ZipException("Unsupported compression method ${entry.method} for ${entry.name}")
    }
  }

  private fun read(position: Long, length: Int): ByteBuffer {
    val buffer = ByteBuffer.allocate(length).order(ByteOrder.LITTLE_ENDIAN)
    var at = position
    while (buffer.hasRemaining()) {
      val count = channel.read(buffer, at)
      if (count < 0) throw EOFException("Unexpected end of zip archive")
      at += count
    }
    buffer.flip()
    return buffer
  }

  private fun readCentralDirectory(): List<Entry> {
    val archiveSize = channel.size()
    val tailLength = minOf(archiveSize, (MAX_COMMENT + END_SIZE).toLong()).toInt()
    if (tailLength < END_SIZE) throw ZipException("Not a zip archive")
    val tailStart = archiveSize - tailLength
    val tail = read(tailStart, tailLength)
    var end = tailLength - END_SIZE
    // The archive comment may contain the signature too; the real record's
    // comment reaches exactly to the end of the file.
    while (end >= 0 &&
      (tail.getInt(end) != END_SIGNATURE || end + END_SIZE + tail.u16(end + 20) != tailLength)
    ) {
      end--
    }
    if (end < 0) throw ZipException("Not a zip archive")

    var entryCount = tail.u16(end + 10).toLong()
    var directorySize = tail.u32(end + 12)
    var directoryOffset = tail.u32(end + 16)
    val locator = end - ZIP64_LOCATOR_SIZE
    if (locator >= 0 && tail.getInt(locator) == ZIP64_LOCATOR_SIGNATURE) {
      val zip64End = read(tail.getLong(locator + 8), ZIP64_END_SIZE)
      if (zip64End.getInt(0) != ZIP64_END_SIGNATURE) {
        throw ZipException("Invalid zip64 end of central directory")
      }
      entryCount = zip64End.getLong(32)
      directorySize = zip64End.getLong(40)
      directoryOffset = zip64End.getLong(48)
    }
    // Zip64 values are signed 64-bit, so a crafted archive can make the sum
    // overflow; compare against the space left instead.
    if (directoryOffset < 0 || directorySize < 0 ||
      directoryOffset > archiveSize || directorySize > archiveSize - directoryOffset
    ) {
      throw ZipException("Invalid central directory")
    }
    // The index is kept in memory while the archive is open, so its size is
    // capped. A 7,323-novel backup has 14,499 entries in a 0.9 MB directory.
    if (entryCount > MAX_ENTRIES || entryCount < 0) {
      throw ZipException("The archive has more than $MAX_ENTRIES entries")
    }
    if (directorySize > MAX_DIRECTORY_BYTES) {
      throw ZipException("The archive's central directory is larger than $MAX_DIRECTORY_BYTES bytes")
    }

    val directory = DirectoryReader(directoryOffset, directoryOffset + directorySize)
    val result = ArrayList<Entry>()
    while (directory.request(CENTRAL_HEADER_SIZE)) {
      val header = directory.window
      val position = header.position()
      if (header.getInt(position) != CENTRAL_HEADER_SIGNATURE) break
      if (result.size >= MAX_ENTRIES) {
        throw ZipException("The archive has more than $MAX_ENTRIES entries")
      }
      val flags = header.u16(position + 8)
      val method = header.u16(position + 10)
      val crc = header.u32(position + 16)
      var compressedSize = header.u32(position + 20)
      var size = header.u32(position + 24)
      val nameLength = header.u16(position + 28)
      val extraLength = header.u16(position + 30)
      val commentLength = header.u16(position + 32)
      var localHeaderOffset = header.u32(position + 42)
      if (!directory.request(CENTRAL_HEADER_SIZE + nameLength + extraLength)) {
        throw ZipException("Invalid central directory")
      }
      // The request may have moved the record to the start of the window.
      val record = directory.window
      val start = record.position()
      val nameBytes = ByteArray(nameLength)
      record.position(start + CENTRAL_HEADER_SIZE)
      record.get(nameBytes)
      val name = String(nameBytes, Charsets.UTF_8)

      var extra = start + CENTRAL_HEADER_SIZE + nameLength
      val extraEnd = extra + extraLength
      while (extra + 4 <= extraEnd) {
        val id = record.u16(extra)
        val length = record.u16(extra + 2)
        if (id == ZIP64_EXTRA_ID) {
          var field = extra + 4
          val fieldEnd = minOf(field + length, extraEnd)
          fun next(): Long {
            if (field + 8 > fieldEnd) throw ZipException("Invalid zip64 extra field for $name")
            return record.getLong(field).also { field += 8 }
          }
          if (size == UINT32_MAX) size = next()
          if (compressedSize == UINT32_MAX) compressedSize = next()
          if (localHeaderOffset == UINT32_MAX) localHeaderOffset = next()
        }
        extra += 4 + length
      }
      if (flags and ENCRYPTED_FLAG != 0) throw ZipException("Encrypted entry ${name}")
      result.add(
        Entry(name, name.endsWith('/'), method, compressedSize, size, crc, localHeaderOffset),
      )
      record.position(extraEnd)
      directory.skip(commentLength)
    }
    return result
  }

  // Reads the central directory front to back through a fixed-size window, so
  // parsing it needs no buffer the size of the directory.
  private inner class DirectoryReader(private var next: Long, private val end: Long) {
    val window: ByteBuffer =
      ByteBuffer.allocate(DIRECTORY_WINDOW_SIZE).order(ByteOrder.LITTLE_ENDIAN).apply { limit(0) }

    // Makes the next [length] bytes of the directory available from the
    // window's position; false when the directory ends first.
    fun request(length: Int): Boolean {
      if (window.remaining() >= length) return true
      window.compact()
      window.limit(window.position() + minOf(window.remaining().toLong(), maxOf(0L, end - next)).toInt())
      while (window.position() < length && window.hasRemaining()) {
        val count = channel.read(window, next)
        if (count < 0) throw EOFException("Unexpected end of zip archive")
        next += count
      }
      window.flip()
      return window.remaining() >= length
    }

    fun skip(length: Int) {
      val inWindow = minOf(length, window.remaining())
      window.position(window.position() + inWindow)
      next += length - inWindow
    }
  }

  private inner class RegionInputStream(
    private var position: Long,
    private var remaining: Long,
  ) : InputStream() {
    override fun read(): Int {
      val single = ByteArray(1)
      return if (read(single, 0, 1) < 0) -1 else single[0].toInt() and 0xFF
    }

    override fun read(b: ByteArray, off: Int, len: Int): Int {
      if (len == 0) return 0
      if (remaining <= 0) return -1
      val count = channel.read(
        ByteBuffer.wrap(b, off, minOf(len.toLong(), remaining).toInt()),
        position,
      )
      if (count < 0) throw EOFException("Unexpected end of zip entry")
      position += count
      remaining -= count
      return count
    }

    override fun available(): Int = minOf(remaining, Int.MAX_VALUE.toLong()).toInt()
  }

  private class CheckedEntryInputStream(
    private val entry: Entry,
    private val input: InputStream,
  ) : InputStream() {
    private val crc = CRC32()
    private var count = 0L

    override fun read(): Int {
      val single = ByteArray(1)
      return if (read(single, 0, 1) < 0) -1 else single[0].toInt() and 0xFF
    }

    override fun read(b: ByteArray, off: Int, len: Int): Int {
      if (len == 0) return 0
      val read = input.read(b, off, len)
      if (read < 0) {
        if (count != entry.size) {
          throw ZipException("${entry.name} is shorter than its recorded size")
        }
        if (crc.value != entry.crc) throw ZipException("CRC-32 mismatch in ${entry.name}")
        return -1
      }
      count += read
      if (count > entry.size) {
        throw ZipException("${entry.name} is larger than its recorded size")
      }
      crc.update(b, off, read)
      return read
    }

    override fun available(): Int = input.available()

    override fun close() = input.close()
  }

  // A raw deflate stream needs one byte past its end to finish, as in ZipFile.
  private class EntryInflaterInputStream(input: InputStream) :
    InflaterInputStream(input, Inflater(true), BUFFER_SIZE) {
    private var paddingSent = false

    override fun fill() {
      len = `in`.read(buf, 0, buf.size)
      if (len == -1) {
        if (paddingSent) throw EOFException("Unexpected end of zip entry")
        paddingSent = true
        buf[0] = 0
        len = 1
      }
      inf.setInput(buf, 0, len)
    }

    override fun close() {
      try {
        super.close()
      } finally {
        inf.end()
      }
    }
  }

  private companion object {
    const val STORED = 0
    const val DEFLATED = 8
    const val ENCRYPTED_FLAG = 1
    const val BUFFER_SIZE = 64 * 1024
    // Holds the largest record: a 46-byte header with a 64 KiB name and extra.
    const val DIRECTORY_WINDOW_SIZE = 256 * 1024
    const val MAX_ENTRIES = 200_000
    const val MAX_DIRECTORY_BYTES = 16L * 1024 * 1024
    const val MAX_COMMENT = 0xFFFF
    const val UINT32_MAX = 0xFFFFFFFFL
    const val END_SIGNATURE = 0x06054b50
    const val END_SIZE = 22
    const val ZIP64_LOCATOR_SIGNATURE = 0x07064b50
    const val ZIP64_LOCATOR_SIZE = 20
    const val ZIP64_END_SIGNATURE = 0x06064b50
    const val ZIP64_END_SIZE = 56
    const val ZIP64_EXTRA_ID = 0x0001
    const val CENTRAL_HEADER_SIGNATURE = 0x02014b50
    const val CENTRAL_HEADER_SIZE = 46
    const val LOCAL_HEADER_SIGNATURE = 0x04034b50
    const val LOCAL_HEADER_SIZE = 30

    fun ByteBuffer.u16(index: Int): Int = getShort(index).toInt() and 0xFFFF
    fun ByteBuffer.u32(index: Int): Long = getInt(index).toLong() and UINT32_MAX
  }
}
