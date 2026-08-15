#include "EpubChapterNormalizer.hpp"

#include "../pugixml.hpp"

#include <algorithm>
#include <cctype>
#include <cstdio>
#include <string>
#include <vector>

namespace {

std::string getLocalName(const std::string& qualifiedName) {
  const size_t separator = qualifiedName.find(':');
  return separator == std::string::npos
             ? qualifiedName
             : qualifiedName.substr(separator + 1);
}

std::string toLower(std::string value) {
  std::transform(value.begin(), value.end(), value.begin(), [](char character) {
    return static_cast<char>(
        std::tolower(static_cast<unsigned char>(character)));
  });
  return value;
}

std::string trim(std::string value) {
  const auto isNotWhitespace = [](char character) {
    return !std::isspace(static_cast<unsigned char>(character));
  };
  const auto start = std::find_if(value.begin(), value.end(), isNotWhitespace);
  const auto end = std::find_if(value.rbegin(), value.rend(), isNotWhitespace)
                       .base();
  return start < end ? std::string(start, end) : "";
}

std::string getImageReference(const pugi::xml_node& image) {
  for (const pugi::xml_attribute attribute : image.attributes()) {
    if (toLower(getLocalName(attribute.name())) == "href") {
      return attribute.value();
    }
  }
  return "";
}

void collectSvgNodes(const pugi::xml_node& parent,
                     std::vector<pugi::xml_node>& svgNodes) {
  for (const pugi::xml_node child : parent.children()) {
    if (child.type() != pugi::node_element) {
      continue;
    }
    if (toLower(getLocalName(child.name())) == "svg") {
      svgNodes.push_back(child);
    }
    collectSvgNodes(child, svgNodes);
  }
}

bool normalizeImageWrapper(const pugi::xml_node& svg) {
  std::vector<pugi::xml_node> images;
  std::string description;

  for (const pugi::xml_node child : svg.children()) {
    if (child.type() != pugi::node_element) {
      continue;
    }

    const std::string childName = toLower(getLocalName(child.name()));
    if (childName == "image") {
      if (getImageReference(child).empty()) {
        return false;
      }
      images.push_back(child);
    } else if (childName == "title" || childName == "desc") {
      if (description.empty()) {
        description = trim(child.text().as_string());
      }
    } else {
      return false;
    }
  }

  if (images.empty()) {
    return false;
  }

  pugi::xml_node parent = svg.parent();
  for (const pugi::xml_node image : images) {
    pugi::xml_node htmlImage = parent.insert_child_before("img", svg);
    for (const pugi::xml_attribute attribute : image.attributes()) {
      if (toLower(getLocalName(attribute.name())) != "href") {
        htmlImage.append_attribute(attribute.name()) = attribute.value();
      }
    }
    htmlImage.append_attribute("src") = getImageReference(image).c_str();
    if (!description.empty() && !htmlImage.attribute("alt")) {
      htmlImage.append_attribute("alt") = description.c_str();
    }
  }

  return parent.remove_child(svg);
}

} // namespace

bool normalizeEpubChapter(const std::string& chapterPath) {
  pugi::xml_document document;
  if (!document.load_file(chapterPath.c_str(), pugi::parse_full)) {
    return false;
  }

  std::vector<pugi::xml_node> svgNodes;
  collectSvgNodes(document, svgNodes);

  bool changed = false;
  for (const pugi::xml_node svg : svgNodes) {
    changed = normalizeImageWrapper(svg) || changed;
  }
  if (!changed) {
    return false;
  }

  const std::string temporaryPath = chapterPath + ".lnreader-normalized";
  const unsigned int format = pugi::format_raw | pugi::format_no_declaration;
  if (!document.save_file(temporaryPath.c_str(), "", format)) {
    std::remove(temporaryPath.c_str());
    return false;
  }
  if (std::rename(temporaryPath.c_str(), chapterPath.c_str()) != 0) {
    std::remove(temporaryPath.c_str());
    return false;
  }
  return true;
}
