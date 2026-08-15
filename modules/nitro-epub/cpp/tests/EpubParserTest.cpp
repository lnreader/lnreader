#include "../import/EpubParser.hpp"

#include <algorithm>
#include <cassert>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

namespace {

void writeFile(const std::filesystem::path& path, const std::string& content) {
  std::filesystem::create_directories(path.parent_path());
  std::ofstream file(path);
  file << content;
}

std::string readFile(const std::filesystem::path& path) {
  std::ifstream file(path);
  return {std::istreambuf_iterator<char>(file),
          std::istreambuf_iterator<char>()};
}

bool containsPath(const std::vector<std::string>& paths,
                  const std::filesystem::path& expectedPath) {
  return std::find(paths.begin(), paths.end(), expectedPath.string()) !=
         paths.end();
}

} // namespace

int main(int argc, char** argv) {
  assert(argc == 2);
  const std::filesystem::path fixtureDirectory = argv[1];
  std::filesystem::remove_all(fixtureDirectory);

  writeFile(
      fixtureDirectory / "META-INF/container.xml",
      R"xml(<?xml version="1.0"?>
<container>
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf"/>
  </rootfiles>
</container>)xml");

  writeFile(
      fixtureDirectory / "OEBPS/content.opf",
      R"xml(<?xml version="1.0"?>
<package version="3.0">
  <metadata>
    <dc:title>Image fixture</dc:title>
    <meta name="cover" content="cover-document"/>
  </metadata>
  <manifest>
    <item id="nav" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="cover-document" href="Text/cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter" href="Text/chapter.xhtml" media-type="application/xhtml+xml"/>
    <item id="jpeg" href="Images/cover.jpg" media-type="image/jpeg"/>
    <item id="png" href="Images/illustration.png" media-type="image/png"/>
    <item id="webp" href="Images/illustration.webp" media-type="image/webp"/>
    <item id="gif" href="Images/illustration.gif" media-type="image/gif"/>
    <item id="svg" href="Images/illustration.svg" media-type="image/svg+xml"/>
  </manifest>
  <spine>
    <itemref idref="cover-document"/>
    <itemref idref="chapter"/>
  </spine>
</package>)xml");

  writeFile(
      fixtureDirectory / "OEBPS/toc.ncx",
      R"xml(<?xml version="1.0"?>
<ncx>
  <navMap>
    <navPoint>
      <navLabel><text>Chapter</text></navLabel>
      <content src="Text/chapter.xhtml"/>
    </navPoint>
  </navMap>
</ncx>)xml");
  writeFile(
      fixtureDirectory / "OEBPS/Text/chapter.xhtml",
      R"xml(<html><body>
<svg><title>Chapter art</title><image width="1200" height="1600" href="../Images/illustration.png"/></svg>
<svg xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="../Images/illustration.webp"/><path d="M0 0h10v10z"/></svg>
</body></html>)xml");
  writeFile(
      fixtureDirectory / "OEBPS/Text/cover.xhtml",
      R"xml(<html><body><svg xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="../Images/cover.jpg"/></svg></body></html>)xml");

  const EpubMetadata metadata = parseEpub(fixtureDirectory.string());
  const std::filesystem::path imageDirectory = fixtureDirectory / "OEBPS/Images";

  assert(metadata.imagePaths.size() == 5);
  assert(containsPath(metadata.imagePaths, imageDirectory / "cover.jpg"));
  assert(containsPath(metadata.imagePaths,
                      imageDirectory / "illustration.png"));
  assert(containsPath(metadata.imagePaths,
                      imageDirectory / "illustration.webp"));
  assert(containsPath(metadata.imagePaths,
                      imageDirectory / "illustration.gif"));
  assert(containsPath(metadata.imagePaths,
                      imageDirectory / "illustration.svg"));
  assert(metadata.cover == (imageDirectory / "cover.jpg").string());
  assert(metadata.chapters.size() == 2);
  assert(metadata.chapters.front().path ==
         (fixtureDirectory / "OEBPS/Text/cover.xhtml").string());

  const std::string coverChapter =
      readFile(fixtureDirectory / "OEBPS/Text/cover.xhtml");
  assert(coverChapter.find("<svg") == std::string::npos);
  assert(coverChapter.find("<img src=\"../Images/cover.jpg\"") !=
         std::string::npos);

  const std::string regularChapter =
      readFile(fixtureDirectory / "OEBPS/Text/chapter.xhtml");
  assert(regularChapter.find(
             "<img width=\"1200\" height=\"1600\" "
             "src=\"../Images/illustration.png\" alt=\"Chapter art\"") !=
         std::string::npos);
  assert(regularChapter.find(
             "<image xlink:href=\"../Images/illustration.webp\"") !=
         std::string::npos);
  assert(regularChapter.find("<path d=\"M0 0h10v10z\"") !=
         std::string::npos);

  return 0;
}
