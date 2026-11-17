package expo.modules.nativeziparchive

import java.io.Closeable
import java.io.EOFException
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
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
    val localHeaderOffset: Long,
  )

  val entries: List<Entry> = readCentralDirectory()

  override fun close() = owner.close()

  fun open(entry: Entry): InputStream {
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

    var directorySize = tail.u32(end + 12)
    var directoryOffset = tail.u32(end + 16)
    val locator = end - ZIP64_LOCATOR_SIZE
    if (locator >= 0 && tail.getInt(locator) == ZIP64_LOCATOR_SIGNATURE) {
      val zip64End = read(tail.getLong(locator + 8), ZIP64_END_SIZE)
      if (zip64End.getInt(0) != ZIP64_END_SIGNATURE) {
        throw ZipException("Invalid zip64 end of central directory")
      }
      directorySize = zip64End.getLong(40)
      directoryOffset = zip64End.getLong(48)
    }
    // Zip64 values are signed 64-bit, so a crafted archive can make the sum
    // overflow; compare against the space left instead.
    if (directoryOffset < 0 || directorySize < 0 || directorySize > Int.MAX_VALUE ||
      directoryOffset > archiveSize || directorySize > archiveSize - directoryOffset
    ) {
      throw ZipException("Invalid central directory")
    }

    val directory = read(directoryOffset, directorySize.toInt())
    val result = ArrayList<Entry>()
    var position = 0
    while (position + CENTRAL_HEADER_SIZE <= directory.limit() &&
      directory.getInt(position) == CENTRAL_HEADER_SIGNATURE
    ) {
      val flags = directory.u16(position + 8)
      val method = directory.u16(position + 10)
      var compressedSize = directory.u32(position + 20)
      var size = directory.u32(position + 24)
      val nameLength = directory.u16(position + 28)
      val extraLength = directory.u16(position + 30)
      val commentLength = directory.u16(position + 32)
      var localHeaderOffset = directory.u32(position + 42)
      val nameBytes = ByteArray(nameLength)
      directory.position(position + CENTRAL_HEADER_SIZE)
      directory.get(nameBytes)
      val name = String(nameBytes, Charsets.UTF_8)

      var extra = position + CENTRAL_HEADER_SIZE + nameLength
      val extraEnd = extra + extraLength
      while (extra + 4 <= extraEnd) {
        val id = directory.u16(extra)
        val length = directory.u16(extra + 2)
        if (id == ZIP64_EXTRA_ID) {
          var field = extra + 4
          if (size == UINT32_MAX) {
            size = directory.getLong(field)
            field += 8
          }
          if (compressedSize == UINT32_MAX) {
            compressedSize = directory.getLong(field)
            field += 8
          }
          if (localHeaderOffset == UINT32_MAX) {
            localHeaderOffset = directory.getLong(field)
          }
        }
        extra += 4 + length
      }
      if (flags and ENCRYPTED_FLAG != 0) throw ZipException("Encrypted entry ${name}")
      result.add(
        Entry(name, name.endsWith('/'), method, compressedSize, size, localHeaderOffset),
      )
      position = extraEnd + commentLength
    }
    return result
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
