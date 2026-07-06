#pragma once

#include <string>
#include <vector>

struct Chapter {
  std::string name;
  std::string path;
};

struct EpubMetadata {
  std::string name;
  std::string path;
  std::string cover;
  std::string summary;
  std::string author;
  std::string artist;
  std::vector<Chapter> chapters;
  std::vector<std::string> cssPaths;
  std::vector<std::string> imagePaths;
};

EpubMetadata parseEpub(const std::string epub_path);
