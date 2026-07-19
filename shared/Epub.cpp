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

bool hasToken(const std::string &value, const std::string &token)
{
    std::stringstream ss(value);
    std::string segment;
    while (ss >> segment)
    {
        if (segment == token)
        {
            return true;
        }
    }
    return false;
}

bool isTagName(const pugi::xml_node &node, const std::string &name)
{
    std::string node_name = node.name();
    if (node_name == name)
    {
        return true;
    }
    size_t pos = node_name.find(':');
    if (pos != std::string::npos)
    {
        return node_name.substr(pos + 1) == name;
    }
    return false;
}

std::string resolve_href(const std::string &base_dir,
                         const std::string &opf_dir,
                         const std::string &href)
{
    if (href.empty())
    {
        return "";
    }
    if (href.front() == '/')
    {
        return join(base_dir, href.substr(1));
    }
    return join(opf_dir, href);
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

bool is_toc_nav(const pugi::xml_node &node)
{
    std::string epub_type = node.attribute("epub:type").value();
    std::string type = node.attribute("type").value();
    std::string role = node.attribute("role").value();
    return hasToken(epub_type, "toc") || hasToken(type, "toc") || hasToken(role, "doc-toc");
}

void parse_navele_recursive(const pugi::xml_node &parent,
                            std::unordered_map<std::string, std::string> &href_to_label,
                            const std::string &nav_folder,
                            const std::string &root_folder)
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
            {
                if (href.front() == '/')
                {
                    href_to_label[join(root_folder, href.substr(1))] = label;
                }
                else
                {
                    href_to_label[join(nav_folder, href)] = label;
                }
            }
        }

        if (pugi::xml_node sublist = li.child("ol"))
        {
            parse_navele_recursive(sublist, href_to_label, nav_folder, root_folder);
        }
    }
}

bool find_first_list(const pugi::xml_node &node, pugi::xml_node &result)
{
    for (pugi::xml_node child : node.children())
    {
        if (isTagName(child, "ol") || isTagName(child, "ul"))
        {
            result = child;
            return true;
        }
        if (find_first_list(child, result))
        {
            return true;
        }
    }
    return false;
}

void collect_nav_nodes(const pugi::xml_node &node, std::vector<pugi::xml_node> &navs)
{
    for (pugi::xml_node child : node.children())
    {
        if (isTagName(child, "nav"))
        {
            navs.push_back(child);
        }
        collect_nav_nodes(child, navs);
    }
}

void parse_nav_xhtml(const std::string &nav_path,
                     std::unordered_map<std::string, std::string> &path_to_label,
                     const std::string &root_folder)
{
    std::string nav_folder = getParentPath(nav_path);
    pugi::xml_document nav_doc;
    if (!nav_doc.load_file(nav_path.c_str()))
        return;

    std::vector<pugi::xml_node> nav_nodes;
    collect_nav_nodes(nav_doc, nav_nodes);
    if (nav_nodes.empty())
        return;

    pugi::xml_node toc_nav;
    for (pugi::xml_node node : nav_nodes)
    {
        if (is_toc_nav(node))
        {
            toc_nav = node;
            break;
        }
    }
    if (!toc_nav)
    {
        toc_nav = nav_nodes.front();
    }

    pugi::xml_node list_node;
    if (!find_first_list(toc_nav, list_node))
    {
        return;
    }

    parse_navele_recursive(list_node, path_to_label, nav_folder, root_folder);
}

void parse_navpoint_recursive(const pugi::xml_node &navPoint,
                              std::unordered_map<std::string, std::string> &result,
                              const std::string &ncx_folder,
                              const std::string &root_folder)
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
            if (!src.empty())
            {
                if (src.front() == '/')
                {
                    result[join(root_folder, src.substr(1))] = label;
                }
                else
                {
                    result[join(ncx_folder, src)] = label;
                }
            }
        }

        parse_navpoint_recursive(point, result, ncx_folder, root_folder);
    }
}

void parse_toc_ncx(const std::string &ncx_path,
                   std::unordered_map<std::string, std::string> &href_to_label,
                   const std::string &root_folder)
{
    std::string ncx_folder = getParentPath(ncx_path);
    pugi::xml_document doc;
    if (!doc.load_file(ncx_path.c_str()))
        return;

    pugi::xml_node navMap = doc.child("ncx").child("navMap");
    if (!navMap)
        return;

    parse_navpoint_recursive(navMap, href_to_label, ncx_folder, root_folder);
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

    auto metadata = opf_doc.child("package").child("metadata");
    meta_out.name = metadata.child("dc:title").text().as_string();
    meta_out.author = metadata.child("dc:creator").text().as_string();
    meta_out.artist = metadata.child("dc:contributor").text().as_string();
    meta_out.summary = metadata.child("dc:description").text().as_string();

    std::unordered_map<std::string, std::string> id_to_href;

    auto manifest = opf_doc.child("package").child("manifest");
    std::string nav_href;
    std::string ncx_href;
    std::string cover_href;
    for (pugi::xml_node item : manifest.children("item"))
    {
        std::string id = item.attribute("id").value();
        std::string href = item.attribute("href").value();
        std::string media_type = item.attribute("media-type").value();
        std::string properties = item.attribute("properties").value();

        id_to_href[id] = href;
        if (media_type == "text/css")
        {
            meta_out.cssPaths.push_back(resolve_href(base_dir, opf_dir, href));
        }
        else if (media_type.rfind("image/", 0) == 0)
        {
            meta_out.imagePaths.push_back(resolve_href(base_dir, opf_dir, href));
        }
        if (hasToken(properties, "nav"))
        {
            nav_href = href;
        }
        if (media_type == "application/x-dtbncx+xml" || id == "ncx")
        {
            ncx_href = href;
        }
        if (hasToken(properties, "cover-image"))
        {
            cover_href = href;
        }
    }

    std::string cover_id;
    for (pugi::xml_node meta : metadata.children("meta"))
    {
        std::string name = meta.attribute("name").value();
        std::string property = meta.attribute("property").value();
        std::string content = meta.attribute("content").value();
        std::string refines = meta.attribute("refines").value();

        if (name == "cover")
        {
            cover_id = content;
        }
        else if (property == "cover")
        {
            cover_id = !content.empty() ? content : meta.text().as_string();
        }
        else if (property == "cover-image")
        {
            if (!refines.empty())
            {
                cover_id = refines;
            }
            else if (!content.empty())
            {
                cover_id = content;
            }
        }

        if (!cover_id.empty())
        {
            if (cover_id.front() == '#')
            {
                cover_id = cover_id.substr(1);
            }
            break;
        }
    }

    if (cover_href.empty() && !cover_id.empty() && id_to_href.count(cover_id))
    {
        cover_href = id_to_href[cover_id];
    }
    if (!cover_href.empty())
    {
        meta_out.cover = resolve_href(base_dir, opf_dir, cover_href);
    }

    std::unordered_map<std::string, std::string> path_to_label;
    std::string toc_href;
    bool is_nav = false;
    if (!nav_href.empty())
    {
        toc_href = nav_href;
        is_nav = true;
    }
    else
    {
        auto spine = opf_doc.child("package").child("spine");
        std::string toc_id = spine ? spine.attribute("toc").value() : "";
        if (!toc_id.empty() && id_to_href.count(toc_id))
        {
            toc_href = id_to_href[toc_id];
        }
        else if (!ncx_href.empty())
        {
            toc_href = ncx_href;
        }
    }

    if (!toc_href.empty())
    {
        if (!is_nav)
        {
            if (toc_href.find(".xhtml") != std::string::npos || toc_href.find(".html") != std::string::npos || toc_href.find(".htm") != std::string::npos)
            {
                is_nav = true;
            }
        }
        if (is_nav)
        {
            std::string nav_path = resolve_href(base_dir, opf_dir, toc_href);
            parse_nav_xhtml(nav_path, path_to_label, base_dir);
        }
        else
        {
            std::string ncx_path = resolve_href(base_dir, opf_dir, toc_href);
            parse_toc_ncx(ncx_path, path_to_label, base_dir);
        }
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
            chapter.path = resolve_href(base_dir, opf_dir, chapter_href);

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
