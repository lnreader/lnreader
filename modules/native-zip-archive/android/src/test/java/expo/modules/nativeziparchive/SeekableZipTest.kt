package expo.modules.nativeziparchive

import java.io.ByteArrayOutputStream
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipException
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class SeekableZipTest {
  @get:Rule
  val folder = TemporaryFolder()

  @Test
  fun entryThatInflatesPastItsRecordedSizeFails() {
    val bytes = zipOf("NovelAndChapters/1.json" to ByteArray(4 * 1024 * 1024))
    setCentralField(bytes, "NovelAndChapters/1.json", UNCOMPRESSED_SIZE_OFFSET, 100)

    open(bytes).use { zip ->
      assertFails("larger than its recorded size") {
        zip.open(zip.entries.single()).use { it.readBytes() }
      }
    }
  }

  @Test
  fun readTextRefusesAnEntryOverTheLimit() {
    val bytes = zipOf("NovelAndChapters/1.json" to ByteArray(2048) { 'a'.code.toByte() })

    open(bytes).use { zip ->
      assertFails("larger than 1024 bytes") { zip.readText(zip.entries.single(), 1024) }
      assertEquals("a".repeat(2048), zip.readText(zip.entries.single(), 2048))
    }
  }

  @Test
  fun corruptStoredEntryFailsAtItsEnd() {
    val cover = ByteArray(10_000) { it.toByte() }
    val bytes = zipOf("Covers/1" to cover, stored = true)
    bytes[dataOffset(bytes, "Covers/1") + 5000] = 0x55

    open(bytes).use { zip ->
      assertFails("CRC-32 mismatch") { zip.open(zip.entries.single()).use { it.readBytes() } }
    }
  }

  @Test
  fun entryShorterThanItsRecordedSizeFails() {
    val bytes = zipOf("Covers/1" to ByteArray(10_000) { (it * 7).toByte() })
    setCentralField(bytes, "Covers/1", UNCOMPRESSED_SIZE_OFFSET, 10_001)

    open(bytes).use { zip ->
      assertFails("shorter than its recorded size") {
        zip.open(zip.entries.single()).use { it.readBytes() }
      }
    }
  }

  @Test
  fun extractKeepsTheDestinationWhenTheEntryIsCorrupt() {
    val bytes = zipOf("Covers/1" to ByteArray(10_000) { it.toByte() }, stored = true)
    bytes[dataOffset(bytes, "Covers/1") + 9_999] = 0x55
    val library = folder.newFolder("library")
    val cover = File(library, "cover.png").apply { writeText("good cover") }

    open(bytes).use { zip ->
      assertFails("CRC-32 mismatch") { zip.extract(zip.entries.single(), cover) }
    }
    assertEquals("good cover", cover.readText())
    assertEquals(listOf("cover.png"), library.list()!!.toList())
  }

  @Test
  fun extractReplacesTheDestination() {
    val data = ByteArray(200_000) { (it % 251).toByte() }
    val library = folder.newFolder("library")
    val cover = File(library, "cover.png").apply { writeText("old cover") }

    open(zipOf("Covers/1" to data)).use { zip -> zip.extract(zip.entries.single(), cover) }
    assertArrayEquals(data, cover.readBytes())
    assertEquals(listOf("cover.png"), library.list()!!.toList())
  }

  @Test
  fun rejectsADirectoryWithTooManyEntries() {
    val file = folder.newFile("many.zip")
    val directory = ByteArrayOutputStream()
    val record = ByteBuffer.allocate(47).order(ByteOrder.LITTLE_ENDIAN)
    repeat(200_001) {
      record.clear()
      record.putInt(0x02014b50).put(ByteArray(24)).putShort(1).put(ByteArray(16)).put('a'.code.toByte())
      directory.write(record.array())
    }
    val end = ByteBuffer.allocate(22).order(ByteOrder.LITTLE_ENDIAN)
      .putInt(0x06054b50).putShort(0).putShort(0).putShort(-1).putShort(-1)
      .putInt(directory.size()).putInt(0).putShort(0)
    file.writeBytes(directory.toByteArray() + end.array())

    assertFails("more than 200000 entries") { openFile(file) }
  }

  @Test
  fun rejectsAnOversizedDirectoryBeforeReadingIt() {
    val file = folder.newFile("huge-directory.zip")
    val directorySize = 64L * 1024 * 1024
    RandomAccessFile(file, "rw").use { raf ->
      raf.setLength(directorySize)
      raf.seek(directorySize)
      val end = ByteBuffer.allocate(22).order(ByteOrder.LITTLE_ENDIAN)
        .putInt(0x06054b50).putShort(0).putShort(0).putShort(1).putShort(1)
        .putInt(directorySize.toInt()).putInt(0).putShort(0)
      raf.write(end.array())
    }

    assertFails("central directory is larger than") { openFile(file) }
  }

  @Test
  fun readsTheSameEntriesAsZipFile() {
    // Long names, extra fields and comments make records cross the
    // directory reader's window boundaries.
    val file = folder.newFile("varied.zip")
    ZipOutputStream(file.outputStream()).use { zip ->
      repeat(3_000) { index ->
        val entry = ZipEntry("NovelAndChapters/${"n".repeat(index % 1_500)}$index.json")
        if (index % 3 == 0) entry.extra = ByteArray(4 + index % 400).also { it[0] = 0x99.toByte() }
        if (index % 5 == 0) entry.comment = "c".repeat(index % 700)
        zip.putNextEntry(entry)
        zip.write("{\"id\":$index}".repeat(index % 50).toByteArray())
        zip.closeEntry()
      }
    }

    val expected = ZipFile(file).use { zip ->
      zip.entries().toList().associate { it.name to zip.getInputStream(it).readBytes() }
    }
    val actual = openFile(file).use { zip ->
      zip.entries.associate { it.name to zip.open(it).use { input -> input.readBytes() } }
    }
    assertEquals(expected.keys.toList(), actual.keys.toList())
    expected.forEach { (name, data) -> assertArrayEquals(name, data, actual[name]) }
  }

  private fun zipOf(vararg entries: Pair<String, ByteArray>, stored: Boolean = false): ByteArray {
    val output = ByteArrayOutputStream()
    ZipOutputStream(output).use { zip ->
      entries.forEach { (name, data) ->
        val entry = ZipEntry(name)
        if (stored) {
          entry.method = ZipEntry.STORED
          entry.size = data.size.toLong()
          entry.crc = CRC32().apply { update(data) }.value
        }
        zip.putNextEntry(entry)
        zip.write(data)
        zip.closeEntry()
      }
    }
    return output.toByteArray()
  }

  private fun open(bytes: ByteArray): SeekableZip =
    openFile(folder.newFile().apply { writeBytes(bytes) })

  private fun openFile(file: File): SeekableZip {
    val raf = RandomAccessFile(file, "r")
    return try {
      SeekableZip(raf.channel, raf)
    } catch (e: Exception) {
      raf.close()
      throw e
    }
  }

  private fun buffer(bytes: ByteArray) = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)

  private fun find(bytes: ByteArray, signature: Int, name: String, nameOffset: Int): Int {
    val buffer = buffer(bytes)
    val nameBytes = name.toByteArray()
    for (position in 0 until bytes.size - nameOffset - nameBytes.size) {
      if (buffer.getInt(position) == signature &&
        bytes.copyOfRange(position + nameOffset, position + nameOffset + nameBytes.size)
          .contentEquals(nameBytes)
      ) {
        return position
      }
    }
    throw AssertionError("No record for $name")
  }

  private fun setCentralField(bytes: ByteArray, name: String, field: Int, value: Int) {
    buffer(bytes).putInt(find(bytes, 0x02014b50, name, 46) + field, value)
  }

  private fun dataOffset(bytes: ByteArray, name: String): Int {
    val header = find(bytes, 0x04034b50, name, 30)
    val buffer = buffer(bytes)
    return header + 30 + (buffer.getShort(header + 26).toInt() and 0xFFFF) +
      (buffer.getShort(header + 28).toInt() and 0xFFFF)
  }

  private fun assertFails(message: String, block: () -> Unit) {
    try {
      block()
    } catch (e: ZipException) {
      assertTrue("\"${e.message}\" should mention \"$message\"", e.message!!.contains(message))
      return
    }
    fail("Expected a ZipException mentioning \"$message\"")
  }

  private companion object {
    const val UNCOMPRESSED_SIZE_OFFSET = 24
  }
}
