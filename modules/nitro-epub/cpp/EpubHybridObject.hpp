#pragma once

#include <NitroModules/HybridObject.hpp>
#include <NitroModules/AnyMap.hpp>
#include <string>

namespace margelo::nitro {

class EpubHybridObject : public HybridObject {
public:
  explicit EpubHybridObject() : HybridObject("Epub") {}

  std::shared_ptr<AnyMap> parseNovelAndChapters(const std::string& epubDirPath);

protected:
  void loadHybridMethods() override;
};

} // namespace margelo::nitro
