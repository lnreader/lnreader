#pragma once

#include "HybridEpubSpec.hpp"

namespace margelo::nitro::nitroimportepub {

class HybridEpub : public HybridEpubSpec {
public:
  HybridEpub() : HybridObject(TAG) {}
  ~HybridEpub() override = default;

  EpubNovel parseNovelAndChapters(const std::string& epubDirPath) override;
};

} // namespace margelo::nitro::nitroimportepub
