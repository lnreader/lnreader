#include "EpubContentProcessor.hpp"

#include "../pugixml.hpp"

#include <algorithm>
#include <cctype>
#include <fstream>
#include <regex>
#include <sstream>
#include <stdexcept>
#include <unordered_set>

namespace margelo::nitro::nitroepub {
namespace {

std::string readTextFile(const std::filesystem::path& path) {
  std::ifstream input(path, std::ios::binary);
  if (!input) {
    throw std::runtime_error("Unable to read downloaded chapter " +
                             path.string());
  }
  return std::string(std::istreambuf_iterator<char>(input),
                     std::istreambuf_iterator<char>());
}

std::string lowercase(std::string value) {
  std::transform(value.begin(), value.end(), value.begin(), [](char character) {
    return static_cast<char>(
        std::tolower(static_cast<unsigned char>(character)));
  });
  return value;
}

int hexValue(char character) {
  if (character >= '0' && character <= '9') {
    return character - '0';
  }
  character = static_cast<char>(std::tolower(
      static_cast<unsigned char>(character)));
  if (character >= 'a' && character <= 'f') {
    return character - 'a' + 10;
  }
  return -1;
}

std::string percentDecode(const std::string& value) {
  std::string decoded;
  decoded.reserve(value.size());
  for (std::size_t index = 0; index < value.size(); ++index) {
    if (value[index] == '%' && index + 2 < value.size()) {
      const int high = hexValue(value[index + 1]);
      const int low = hexValue(value[index + 2]);
      if (high >= 0 && low >= 0) {
        decoded += static_cast<char>((high << 4) | low);
        index += 2;
        continue;
      }
    }
    decoded += value[index];
  }
  return decoded;
}

std::string extractBody(std::string html) {
  html = std::regex_replace(
      html, std::regex(R"(<!doctype[^>]*>)", std::regex::icase), "");
  const std::regex bodyPattern(
      R"(<body\b[^>]*>([^]*?)</body\s*>)",
      std::regex::icase);
  std::smatch match;
  if (std::regex_search(html, match, bodyPattern)) {
    return match[1].str();
  }
  return html;
}

std::string makeVoidElementsXmlCompatible(std::string html) {
  const std::regex voidElement(
      R"(<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\b[^<>]*?)(/?)>)",
      std::regex::icase);
  std::string result;
  std::size_t cursor = 0;
  for (std::sregex_iterator iterator(html.begin(), html.end(), voidElement),
       end;
       iterator != end; ++iterator) {
    const auto& match = *iterator;
    result.append(html, cursor, static_cast<std::size_t>(match.position()) -
                                    cursor);
    result += "<" + match[1].str() + match[2].str() + " />";
    cursor = static_cast<std::size_t>(match.position() + match.length());
  }
  result.append(html, cursor, std::string::npos);
  return result;
}

std::string escapeUnsupportedNamedEntities(const std::string& html) {
  static const std::unordered_set<std::string> xmlEntities = {
      "amp", "apos", "gt", "lt", "quot"};
  const std::regex entity(R"(&([A-Za-z][A-Za-z0-9]+);)");
  std::string result;
  std::size_t cursor = 0;
  for (std::sregex_iterator iterator(html.begin(), html.end(), entity), end;
       iterator != end; ++iterator) {
    const auto& match = *iterator;
    result.append(html, cursor, static_cast<std::size_t>(match.position()) -
                                    cursor);
    const std::string name = match[1].str();
    if (name == "nbsp") {
      result += "&#160;";
    } else {
      result += xmlEntities.contains(name) ? match.str()
                                          : "&amp;" + name + ";";
    }
    cursor = static_cast<std::size_t>(match.position() + match.length());
  }
  result.append(html, cursor, std::string::npos);
  return result;
}

void removeUnsafeContent(pugi::xml_node node) {
  for (pugi::xml_node child = node.first_child(); child;) {
    pugi::xml_node next = child.next_sibling();
    const std::string name = lowercase(child.name());
    if (name == "script" || name == "iframe" || name == "object" ||
        name == "embed") {
      node.remove_child(child);
    } else {
      for (pugi::xml_attribute attribute = child.first_attribute();
           attribute;) {
        pugi::xml_attribute nextAttribute = attribute.next_attribute();
        const std::string attributeName = lowercase(attribute.name());
        if (attributeName.rfind("on", 0) == 0) {
          child.remove_attribute(attribute);
        }
        attribute = nextAttribute;
      }
      removeUnsafeContent(child);
    }
    child = next;
  }
}

std::string serializeChildren(const pugi::xml_node& root) {
  std::ostringstream output;
  for (const pugi::xml_node& child : root.children()) {
    child.print(output, "", pugi::format_raw, pugi::encoding_utf8);
  }
  return output.str();
}

void processImages(
    pugi::xml_node node,
    ZipWriter& zip,
    std::unordered_map<std::string, EpubAsset>& knownAssets,
    std::vector<EpubAsset>& assets) {
  for (pugi::xml_node child = node.first_child(); child;) {
    pugi::xml_node next = child.next_sibling();
    if (lowercase(child.name()) != "img") {
      processImages(child, zip, knownAssets, assets);
      child = next;
      continue;
    }

    pugi::xml_attribute source = child.attribute("src");
    const std::filesystem::path localPath =
        source ? localPathFromUri(source.value()) : std::filesystem::path();
    if (localPath.empty() || !std::filesystem::is_regular_file(localPath)) {
      node.remove_child(child);
      child = next;
      continue;
    }

    const std::string key =
        std::filesystem::weakly_canonical(localPath).string();
    auto assetIterator = knownAssets.find(key);
    if (assetIterator == knownAssets.end()) {
      const std::string extension = normalizedImageExtension(localPath);
      const std::string index = std::to_string(assets.size());
      EpubAsset asset{
          "image-" + index,
          "EPUB/images/image-" + index + extension,
          imageMediaType(extension),
      };
      zip.addFile(asset.archivePath, localPath);
      assets.push_back(asset);
      assetIterator = knownAssets.emplace(key, std::move(asset)).first;
    }
    const std::string relativePath =
        "../images/" +
        std::filesystem::path(assetIterator->second.archivePath)
            .filename()
            .string();
    source.set_value(relativePath.c_str());
    child.remove_attribute("srcset");
    child = next;
  }
}

} // namespace

std::filesystem::path localPathFromUri(const std::string& uri) {
  constexpr const char* FILE_SCHEME = "file://";
  if (uri.rfind(FILE_SCHEME, 0) == 0) {
    return percentDecode(uri.substr(7));
  }
  if (!uri.empty() && uri.front() == '/') {
    return percentDecode(uri);
  }
  return {};
}

std::string normalizedImageExtension(const std::filesystem::path& path) {
  const std::string extension = lowercase(path.extension().string());
  static const std::unordered_set<std::string> supported = {
      ".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"};
  return supported.contains(extension) ? extension : ".png";
}

std::string imageMediaType(const std::string& extension) {
  if (extension == ".avif") {
    return "image/avif";
  }
  if (extension == ".gif") {
    return "image/gif";
  }
  if (extension == ".jpeg" || extension == ".jpg") {
    return "image/jpeg";
  }
  if (extension == ".svg") {
    return "image/svg+xml";
  }
  if (extension == ".webp") {
    return "image/webp";
  }
  return "image/png";
}

std::string prepareChapterBody(
    const EpubArchiveChapter& chapter,
    ZipWriter& zip,
    std::unordered_map<std::string, EpubAsset>& knownAssets,
    std::vector<EpubAsset>& assets) {
  std::string body = escapeUnsupportedNamedEntities(
      makeVoidElementsXmlCompatible(extractBody(readTextFile(chapter.htmlPath))));
  pugi::xml_document document;
  const std::string wrapped = "<root>" + body + "</root>";
  const pugi::xml_parse_result parsed =
      document.load_string(wrapped.c_str(), pugi::parse_default);
  if (!parsed) {
    throw std::runtime_error(
        "Downloaded chapter is not valid XHTML near byte " +
        std::to_string(parsed.offset) + ": " + parsed.description());
  }

  pugi::xml_node root = document.child("root");
  removeUnsafeContent(root);
  processImages(root, zip, knownAssets, assets);
  return serializeChildren(root);
}

} // namespace margelo::nitro::nitroepub
