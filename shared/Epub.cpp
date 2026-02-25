#include <string>
#include <pugixml.hpp>
#include <iostream>
#include <unordered_map>
#include <vector>
#include <Epub.hpp>
#include <sstream>
#include <regex>

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

void clean_summary(std::string &summary)
{
    std::regex regx0("&nbsp;");
    summary = std::regex_replace(summary, regx0, " ");
    std::regex regx1("</div>\\s*|</p>\\s*");
    summary = std::regex_replace(summary, regx1, "\n\n");
    std::regex regx2("<br>\\s*");
    summary = std::regex_replace(summary, regx2, "\n");
    std::regex regx2a("<hr>");
    summary = std::regex_replace(summary, regx2a, "\n———\n");
    std::regex regxtags("<\/?(?:[abip]|h[0-9]|span|div|strong|em)>");
    summary = std::regex_replace(summary, regxtags, "");
    std::regex regx3("<");
    summary = std::regex_replace(summary, regx3, "⟨");
    std::regex regx3a(">");
    summary = std::regex_replace(summary, regx3a, "⟩");
    std::regex regx4("&lt;");
    summary = std::regex_replace(summary, regx4, "<⁠");
    std::regex regx5("&gt;");
    summary = std::regex_replace(summary, regx5, "⁠>");
    std::regex regx6("&amp;");
    summary = std::regex_replace(summary, regx6, "&");
        std::regex regx7("&Agrave;");
    summary = std::regex_replace(summary, regx7, "À");
    std::regex regx8("&Aacute;");
    summary = std::regex_replace(summary, regx8, "Á");
    std::regex regx9("&Acirc;");
    summary = std::regex_replace(summary, regx9, "Â");
    std::regex regx10("&Atilde;");
    summary = std::regex_replace(summary, regx10, "Ã");
    std::regex regx11("&Auml;");
    summary = std::regex_replace(summary, regx11, "Ä");
    std::regex regx12("&Aring;");
    summary = std::regex_replace(summary, regx12, "Å");
    std::regex regx13("&agrave;");
    summary = std::regex_replace(summary, regx13, "à");
    std::regex regx14("&aacute;");
    summary = std::regex_replace(summary, regx14, "á");
    std::regex regx15("&acirc;");
    summary = std::regex_replace(summary, regx15, "â");
    std::regex regx16("&atilde;");
    summary = std::regex_replace(summary, regx16, "ã");
    std::regex regx17("&auml;");
    summary = std::regex_replace(summary, regx17, "ä");
    std::regex regx18("&aring;");
    summary = std::regex_replace(summary, regx18, "å");
    std::regex regx19("&AElig;");
    summary = std::regex_replace(summary, regx19, "Æ");
    std::regex regx20("&aelig;");
    summary = std::regex_replace(summary, regx20, "æ");
    std::regex regx21("&szlig;");
    summary = std::regex_replace(summary, regx21, "ß");
    std::regex regx22("&Ccedil;");
    summary = std::regex_replace(summary, regx22, "Ç");
    std::regex regx23("&ccedil;");
    summary = std::regex_replace(summary, regx23, "ç");
    std::regex regx24("&Egrave;");
    summary = std::regex_replace(summary, regx24, "È");
    std::regex regx25("&Eacute;");
    summary = std::regex_replace(summary, regx25, "É");
    std::regex regx26("&Ecirc;");
    summary = std::regex_replace(summary, regx26, "Ê");
    std::regex regx27("&Euml;");
    summary = std::regex_replace(summary, regx27, "Ë");
    std::regex regx28("&egrave;");
    summary = std::regex_replace(summary, regx28, "è");
    std::regex regx29("&eacute;");
    summary = std::regex_replace(summary, regx29, "é");
    std::regex regx30("&ecirc;");
    summary = std::regex_replace(summary, regx30, "ê");
    std::regex regx31("&euml;");
    summary = std::regex_replace(summary, regx31, "ë");
    std::regex regx32("&#131;");
    summary = std::regex_replace(summary, regx32, "ƒ");
    std::regex regx33("&Igrave;");
    summary = std::regex_replace(summary, regx33, "Ì");
    std::regex regx34("&Iacute;");
    summary = std::regex_replace(summary, regx34, "Í");
    std::regex regx35("&Icirc;");
    summary = std::regex_replace(summary, regx35, "Î");
    std::regex regx36("&Iuml;");
    summary = std::regex_replace(summary, regx36, "Ï");
    std::regex regx37("&igrave;");
    summary = std::regex_replace(summary, regx37, "ì");
    std::regex regx38("&iacute;");
    summary = std::regex_replace(summary, regx38, "í");
    std::regex regx39("&icirc;");
    summary = std::regex_replace(summary, regx39, "î");
    std::regex regx40("&iuml;");
    summary = std::regex_replace(summary, regx40, "ï");
    std::regex regx41("&Ntilde;");
    summary = std::regex_replace(summary, regx41, "Ñ");
    std::regex regx42("&ntilde;");
    summary = std::regex_replace(summary, regx42, "ñ");
    std::regex regx43("&Ograve;");
    summary = std::regex_replace(summary, regx43, "Ò");
    std::regex regx44("&Oacute;");
    summary = std::regex_replace(summary, regx44, "Ó");
    std::regex regx45("&Ocirc;");
    summary = std::regex_replace(summary, regx45, "Ô");
    std::regex regx46("&Otilde;");
    summary = std::regex_replace(summary, regx46, "Õ");
    std::regex regx47("&Ouml;");
    summary = std::regex_replace(summary, regx47, "Ö");
    std::regex regx48("&ograve;");
    summary = std::regex_replace(summary, regx48, "ò");
    std::regex regx49("&oacute;");
    summary = std::regex_replace(summary, regx49, "ó");
    std::regex regx50("&ocirc;");
    summary = std::regex_replace(summary, regx50, "ô");
    std::regex regx51("&otilde;");
    summary = std::regex_replace(summary, regx51, "õ");
    std::regex regx52("&ouml;");
    summary = std::regex_replace(summary, regx52, "ö");
    std::regex regx53("&Oslash;");
    summary = std::regex_replace(summary, regx53, "Ø");
    std::regex regx54("&oslash;");
    summary = std::regex_replace(summary, regx54, "ø");
    std::regex regx55("&#140;");
    summary = std::regex_replace(summary, regx55, "Œ");
    std::regex regx56("&#156;");
    summary = std::regex_replace(summary, regx56, "œ");
    std::regex regx57("&#138;");
    summary = std::regex_replace(summary, regx57, "Š");
    std::regex regx58("&#154;");
    summary = std::regex_replace(summary, regx58, "š");
    std::regex regx59("&Ugrave;");
    summary = std::regex_replace(summary, regx59, "Ù");
    std::regex regx60("&Uacute;");
    summary = std::regex_replace(summary, regx60, "Ú");
    std::regex regx61("&Ucirc;");
    summary = std::regex_replace(summary, regx61, "Û");
    std::regex regx62("&Uuml;");
    summary = std::regex_replace(summary, regx62, "Ü");
    std::regex regx63("&ugrave;");
    summary = std::regex_replace(summary, regx63, "ù");
    std::regex regx64("&uacute;");
    summary = std::regex_replace(summary, regx64, "ú");
    std::regex regx65("&ucirc;");
    summary = std::regex_replace(summary, regx65, "û");
    std::regex regx66("&uuml;");
    summary = std::regex_replace(summary, regx66, "ü");
    std::regex regx67("&#181;");
    summary = std::regex_replace(summary, regx67, "µ");
    std::regex regx68("&#215;");
    summary = std::regex_replace(summary, regx68, "×");
    std::regex regx69("&Yacute;");
    summary = std::regex_replace(summary, regx69, "Ý");
    std::regex regx70("&#159;");
    summary = std::regex_replace(summary, regx70, "Ÿ");
    std::regex regx71("&yacute;");
    summary = std::regex_replace(summary, regx71, "ý");
    std::regex regx72("&yuml;");
    summary = std::regex_replace(summary, regx72, "ÿ");
    std::regex regx73("&#176;");
    summary = std::regex_replace(summary, regx73, "°");
    std::regex regx74("&#134;");
    summary = std::regex_replace(summary, regx74, "†");
    std::regex regx75("&#135;");
    summary = std::regex_replace(summary, regx75, "‡");
    std::regex regx76("&hellip;");
    summary = std::regex_replace(summary, regx76, "…");
    std::regex regx77("&quot;");
    summary = std::regex_replace(summary, regx77, "\"");
    std::regex regx78("&#177;");
    summary = std::regex_replace(summary, regx78, "±");
    std::regex regx79("&#171;");
    summary = std::regex_replace(summary, regx79, "«");
    std::regex regx80("&#187;");
    summary = std::regex_replace(summary, regx80, "»");
    std::regex regx81("&#191;");
    summary = std::regex_replace(summary, regx81, "¿");
    std::regex regx82("&#161;");
    summary = std::regex_replace(summary, regx82, "¡");
    std::regex regx83("&#183;");
    summary = std::regex_replace(summary, regx83, "·");
    std::regex regx84("&#149;");
    summary = std::regex_replace(summary, regx84, "•");
    std::regex regx85("&#153;");
    summary = std::regex_replace(summary, regx85, "™");
    std::regex regx86("&copy;");
    summary = std::regex_replace(summary, regx86, "©");
    std::regex regx87("&reg;");
    summary = std::regex_replace(summary, regx87, "®");
    std::regex regx88("&#167;");
    summary = std::regex_replace(summary, regx88, "§");
    std::regex regx89("&#182;");
    summary = std::regex_replace(summary, regx89, "¶");
    std::regex regx_clean("\n\n\n\n\n+");
    summary = std::regex_replace(summary, regx_clean, "\n\n\n\n");

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
    clean_summary(meta_out.summary);

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
