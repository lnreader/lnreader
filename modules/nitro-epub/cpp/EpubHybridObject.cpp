#include "EpubHybridObject.hpp"
#include "EpubParser.hpp"

#include <NitroModules/HybridObject.hpp>
#include <NitroModules/AnyMap.hpp>
#include <NitroModules/Prototype.hpp>

namespace margelo::nitro {

void EpubHybridObject::loadHybridMethods() {
  HybridObject::loadHybridMethods();
  registerHybrids(this, [](Prototype& prototype) {
    prototype.registerHybridMethod("parseNovelAndChapters",
      &EpubHybridObject::parseNovelAndChapters);
  });
}

std::shared_ptr<AnyMap> EpubHybridObject::parseNovelAndChapters(
    const std::string& epubDirPath) {
  EpubMetadata metadata = parseEpub(epubDirPath);

  auto result = AnyMap::make();

  result->setString("name", metadata.name);
  result->setString("author", metadata.author);
  result->setString("artist", metadata.artist);
  result->setString("summary", metadata.summary);
  result->setString("cover", metadata.cover);

  AnyArray chapters;
  for (const auto& ch : metadata.chapters) {
    AnyObject chapterObj;
    chapterObj["name"] = ch.name;
    chapterObj["path"] = ch.path;
    chapters.push_back(AnyValue(chapterObj));
  }
  result->setArray("chapters", chapters);

  AnyArray cssPaths;
  for (const auto& path : metadata.cssPaths) {
    cssPaths.push_back(AnyValue(path));
  }
  result->setArray("cssPaths", cssPaths);

  AnyArray imagePaths;
  for (const auto& path : metadata.imagePaths) {
    imagePaths.push_back(AnyValue(path));
  }
  result->setArray("imagePaths", imagePaths);

  return result;
}

} // namespace margelo::nitro
