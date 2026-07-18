#include "HybridEpub.hpp"
#include "EpubParser.hpp"
#include <NitroModules/HybridObjectRegistry.hpp>

namespace margelo::nitro::nitroimportepub {

EpubNovel HybridEpub::parseNovelAndChapters(const std::string& epubDirPath) {
  EpubMetadata metadata = parseEpub(epubDirPath);

  EpubNovel result;
  result.name = metadata.name;
  result.cover = metadata.cover.empty()
    ? std::nullopt
    : std::optional(std::variant<nitro::NullType, std::string>(metadata.cover));
  result.summary = metadata.summary.empty()
    ? std::nullopt
    : std::optional(std::variant<nitro::NullType, std::string>(metadata.summary));
  result.author = metadata.author.empty()
    ? std::nullopt
    : std::optional(std::variant<nitro::NullType, std::string>(metadata.author));
  result.artist = metadata.artist.empty()
    ? std::nullopt
    : std::optional(std::variant<nitro::NullType, std::string>(metadata.artist));

  for (const auto& ch : metadata.chapters) {
    result.chapters.emplace_back(ch.name, ch.path);
  }
  result.cssPaths = metadata.cssPaths;
  result.imagePaths = metadata.imagePaths;

  return result;
}

// Register the HybridObject at load time.
__attribute__((constructor))
static void initEpub() {
  HybridObjectRegistry::registerHybridObjectConstructor(
    "Epub",
    []() -> std::shared_ptr<HybridObject> {
      return std::make_shared<HybridEpub>();
    }
  );
}

} // namespace margelo::nitro::nitroimportepub
