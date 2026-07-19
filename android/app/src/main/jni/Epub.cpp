#include <string>
#include <pugixml.hpp>
#include <iostream>
#include <unordered_map>
#include <vector>
#include <Epub.hpp>
#include <sstream>

std::string join(const std::string &folder_path, const std::string &child_path)
{
    std::string full_path = folder_path;
    if (!full_path.empty() && full_path.back() != '/')
    {
        full_path += '/';
    }

    std::stringstream ss(child_path);
    std::string segment;
    while (std::getline(ss, segment, '/'))
    {
        if (segment == "..")
        {
            // Go up one level
            if (!full_path.empty())
            {
                size_t lastSlash = full_path.rfind('/', full_path.length() - 2);
                if (lastSlash != std::string::npos)
                {
                    full_path.resize(lastSlash + 1);
                }
                else
                {
                    full_path = "";
                }
            }
        }
        else if (segment != "." && !segment.empty())
        {
            full_path += segment + '/';
        }
    }

    if (full_path.length() > 1 && full_path.back() == '/')
    {
        full_path.pop_back();
    }

    return full_path;
}

std::string getParentPath(const std::string &path)
{
    if (path.empty())
        return "";

    size_t pos = path.find_last_of("/\\");
    if (pos == std::string::npos)
    {
        return "";
    }

    return path.substr(0, pos);
}

std::string find_toc_href(const pugi::xml_document &opf_doc)
{
    auto manifest = opf_doc.child("package").child("manifest");
    for (pugi::xml_node item : manifest.children("item"))
    {
        std::string media_type = item.attribute("media-type").value();
        std::string id = item.attribute("id").value();
        if (media_type == "application/x-dtbncx+xml" || id == "ncx" || id == "nav")
        {
            return item.attribute("href").value();
        }
    }
    return "";
}

void parse_navele_recursive(const pugi::xml_node &parent,
                            std::unordered_map<std::string, std::string> &href_to_label, std::string &nav_folder)
{
    for (pugi::xml_node li : parent.children("li"))
    {
        pugi::xml_node a = li.child("a");
        if (a)
        {
            std::string href = a.attribute("href").as_string();
            std::string label = a.text().as_string();

            size_t sharp = href.find('#');
            if (sharp != std::string::npos)
                href = href.substr(0, sharp);

            if (!href.empty() && !label.empty())
                href_to_label[join(nav_folder, href)] = label;
        }

        if (pugi::xml_node sublist = li.child("ol"))
        {
            parse_navele_recursive(sublist, href_to_label, nav_folder);
        }
    }
}

void parse_nav_xhtml(const std::string &nav_path,
                     std::unordered_map<std::string, std::string> &path_to_label)
{
    std::string nav_folder = getParentPath(nav_path);
    pugi::xml_document nav_doc;
    if (!nav_doc.load_file(nav_path.c_str()))
        return;

    for (pugi::xpath_node nav : nav_doc.select_nodes("//nav"))
    {
        pugi::xml_node node = nav.node();
        std::string nav_type = node.attribute("epub:type").as_string();
        pugi::xml_node ol = node.child("ol");
        if (ol)
        {
            parse_navele_recursive(ol, path_to_label, nav_folder);
        }
    }
}

void parse_navpoint_recursive(const pugi::xml_node &navPoint,
                              std::unordered_map<std::string, std::string> &result, std::string &ncx_folder)
{
    for (pugi::xml_node point : navPoint.children("navPoint"))
    {
        std::string label;
        pugi::xml_node labelNode = point.child("navLabel").child("text");
        if (labelNode)
            label = labelNode.text().as_string();

        std::string src;
        pugi::xml_node contentNode = point.child("content");
        if (contentNode)
            src = contentNode.attribute("src").as_string();

        if (!label.empty() && !src.empty())
        {
            size_t sharp = src.find('#');
            if (sharp != std::string::npos)
                src = src.substr(0, sharp);
            result[join(ncx_folder, src)] = label;
        }

        parse_navpoint_recursive(point, result, ncx_folder);
    }
}

void parse_toc_ncx(const std::string &ncx_path, std::unordered_map<std::string, std::string> &href_to_label)
{
    std::string ncx_folder = getParentPath(ncx_path);
    pugi::xml_document doc;
    if (!doc.load_file(ncx_path.c_str()))
        return;

    pugi::xml_node navMap = doc.child("ncx").child("navMap");
    if (!navMap)
        return;

    parse_navpoint_recursive(navMap, href_to_label, ncx_folder);
}

void parse_opf_from_folder(const std::string &base_dir,
                           const std::string &opf_rel_path,
                           EpubMetadata &meta_out)
{
    std::string opf_path = join(base_dir, opf_rel_path);
    std::string opf_dir = getParentPath(opf_path);
    pugi::xml_document opf_doc;
    if (!opf_doc.load_file(opf_path.c_str()))
        return;
    std::string version;
    pugi::xml_node package = opf_doc.child("package");
    if (package)
    {
        version = package.attribute("version").as_string();
    }

    std::unordered_map<std::string, std::string> path_to_label;
    std::string toc_href = find_toc_href(opf_doc);
    if (toc_href.find("ncx") != std::string::npos)
    {
        std::string ncx_path = join(opf_dir, toc_href);
        parse_toc_ncx(ncx_path, path_to_label);
    }
    else
    {
        std::string nav_path = join(opf_dir, toc_href);
        parse_nav_xhtml(nav_path, path_to_label);
    }

    auto metadata = opf_doc.child("package").child("metadata");
    meta_out.name = metadata.child("dc:title").text().as_string();
    meta_out.author = metadata.child("dc:creator").text().as_string();
    meta_out.artist = metadata.child("dc:contributor").text().as_string();
    meta_out.summary = metadata.child("dc:description").text().as_string();

    std::unordered_map<std::string, std::string> id_to_href;

    std::string cover_id;
    for (pugi::xml_node meta : metadata.children("meta"))
    {
        if (std::string(meta.attribute("name").value()) == "cover")
        {
            cover_id = meta.attribute("content").value();
            break;
        }
    }

    auto manifest = opf_doc.child("package").child("manifest");
    for (pugi::xml_node item : manifest.children("item"))
    {
        std::string id = item.attribute("id").value();
        std::string href = item.attribute("href").value();
        std::string media_type = item.attribute("media-type").value();

        id_to_href[id] = href;
        if (media_type == "text/css")
        {
            meta_out.cssPaths.push_back(join(opf_dir, href));
        }
        else if (media_type == "image/jpeg" || media_type == "image/png" || media_type == "image/jpg")
        {
            meta_out.imagePaths.push_back(join(opf_dir, href));
        }
    }

    if (!cover_id.empty() && id_to_href.count(cover_id))
    {
        meta_out.cover = join(opf_dir, id_to_href[cover_id]);
    }

    auto spine = opf_doc.child("package").child("spine");
    std::string prev_name = "";
    int part = 2;
    for (pugi::xml_node itemref : spine.children("itemref"))
    {
        std::string idref = itemref.attribute("idref").value();
        if (id_to_href.count(idref))
        {
            std::string chapter_href = id_to_href[idref];
            Chapter chapter;
            chapter.path = join(opf_dir, chapter_href);

            if (path_to_label.count(chapter.path))
            {
                chapter.name = path_to_label[chapter.path];
            }
            if (chapter.name.empty())
            {
                if (prev_name.empty())
                {
                    int start_pos = chapter_href.find_last_of("/");
                    if (start_pos == std::string::npos)
                    {
                        start_pos = 0;
                    }
                    else
                    {
                        start_pos++;
                    }
                    chapter.name = chapter_href.substr(start_pos, chapter_href.find_last_of(".") - start_pos);
                }
                else
                {
                    chapter.name = prev_name + " (" + std::to_string(part) + ")";
                    part += 1;
                }
            }
            else
            {
                prev_name = chapter.name;
                part = 2;
            }

            meta_out.chapters.push_back(chapter);
        }
    }
}

EpubMetadata parseEpub(const std::string epub_path)
{
    std::string container_path = join(epub_path, "META-INF/container.xml");

    pugi::xml_document container_doc;
    if (!container_doc.load_file(container_path.c_str()))
        throw std::runtime_error("Failed to load container.xml");

    std::string opf_path = container_doc.child("container")
                               .child("rootfiles")
                               .child("rootfile")
                               .attribute("full-path")
                               .value();

    EpubMetadata metadata;
    parse_opf_from_folder(epub_path, opf_path, metadata);

    return metadata;
}