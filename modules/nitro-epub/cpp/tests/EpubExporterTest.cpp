#include "../export/EpubContentProcessor.hpp"
#include "../export/EpubExporter.hpp"

#include <cassert>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <string>
#include <vector>

using namespace margelo::nitro::nitroepub;

namespace {

std::uint16_t read16(const std::vector<std::uint8_t>& bytes,
                     std::size_t offset) {
  return static_cast<std::uint16_t>(bytes[offset]) |
         static_cast<std::uint16_t>(bytes[offset + 1] << 8);
}

} // namespace

int main(int argc, char** argv) {
  assert(argc == 2);
  const std::filesystem::path fixtureDirectory = argv[1];
  std::filesystem::remove_all(fixtureDirectory);
  std::filesystem::create_directories(fixtureDirectory);

  const std::filesystem::path imagePath = fixtureDirectory / "image.png";
  {
    const std::uint8_t png[] = {
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    };
    std::ofstream image(imagePath, std::ios::binary);
    image.write(reinterpret_cast<const char*>(png), sizeof(png));
  }

  const std::filesystem::path chapterPath =
      fixtureDirectory / "chapter.html";
  {
    std::ofstream chapter(chapterPath);
    chapter << "<html><body><h1>One &amp; Two</h1>"
            << "<img src=\"file://" << imagePath.string() << "\">"
            << "<img src=\"file:///missing.png\">"
            << "<script>alert('removed')</script></body></html>";
  }

  const std::filesystem::path outputPath = fixtureDirectory / "fixture.epub";
  const EpubArchiveResult result = exportEpubArchive(
      EpubArchiveMetadata{
          "Fixture & Book",
          "en",
          "",
          "Description",
          "LNReader",
          "urn:lnreader:test",
          "body { line-height: 1.5; }",
          "",
      },
      {
          EpubArchiveChapter{
              "Chapter <One>",
              chapterPath.string(),
              "1",
              "2",
          },
          EpubArchiveChapter{
              "Missing chapter",
              (fixtureDirectory / "missing.html").string(),
              "1",
              "3",
          },
      },
      outputPath.string());

  assert(result.chapterCount == 1);
  assert(std::filesystem::is_regular_file(outputPath));

  std::ifstream epub(outputPath, std::ios::binary);
  const std::vector<std::uint8_t> bytes(
      (std::istreambuf_iterator<char>(epub)),
      std::istreambuf_iterator<char>());
  assert(bytes.size() > 30);
  assert(bytes[0] == 0x50 && bytes[1] == 0x4b && bytes[2] == 0x03 &&
         bytes[3] == 0x04);
  assert(read16(bytes, 8) == 0);
  const std::uint16_t nameLength = read16(bytes, 26);
  const std::string firstName(bytes.begin() + 30,
                              bytes.begin() + 30 + nameLength);
  assert(firstName == "mimetype");

  {
    std::ofstream chapter(chapterPath);
    chapter << "<p>Paragraph</p><h2>Subsection</h2>";
  }
  ZipWriter testZip(fixtureDirectory / "heading-test.zip");
  std::unordered_map<std::string, EpubAsset> knownAssets;
  std::vector<EpubAsset> assets;
  const EpubArchiveChapter chapter{
      "Chapter <One>", chapterPath.string(), "1", "2"};
  assert(prepareChapterBody(chapter, testZip, knownAssets, assets) ==
         "<h1>Chapter &lt;One&gt;</h1><p>Paragraph</p><h2>Subsection</h2>");

  {
    std::ofstream chapterFile(chapterPath);
    chapterFile << "<div><h2><em>Source heading</em></h2><p>Text</p></div>";
  }
  assert(prepareChapterBody(chapter, testZip, knownAssets, assets) ==
         "<div><h2><em>Source heading</em></h2><p>Text</p></div>");

  return 0;
}
