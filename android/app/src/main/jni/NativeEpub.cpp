#include <NativeEpub.hpp>

namespace facebook::react
{

    NativeEpub::NativeEpub(std::shared_ptr<CallInvoker> jsInvoker)
        : NativeEpubCxxSpec(std::move(jsInvoker)) {}

    jsi::Object NativeEpub::parseNovelAndChapters(jsi::Runtime &rt, jsi::String epubDirPath)
    {
        jsi::Object novel(rt);
        EpubMetadata metadata = parseEpub(epubDirPath.utf8(rt).c_str());
        novel.setProperty(rt, "name", metadata.name);
        novel.setProperty(rt, "author", metadata.author);
        novel.setProperty(rt, "artist", metadata.artist);
        novel.setProperty(rt, "summary", metadata.summary);
        novel.setProperty(rt, "cover", metadata.cover);

        jsi::Array chapters(rt, metadata.chapters.size());
        for (int i = 0; i < metadata.chapters.size(); i++)
        {
            jsi::Object chapter(rt);
            chapter.setProperty(rt, "name", metadata.chapters[i].name);
            chapter.setProperty(rt, "path", metadata.chapters[i].path);
            chapters.setValueAtIndex(rt, i, chapter);
        }
        novel.setProperty(rt, "chapters", chapters);
        jsi::Array cssPaths(rt, metadata.cssPaths.size());
        for (int i = 0; i < metadata.cssPaths.size(); i++)
        {
            cssPaths.setValueAtIndex(rt, i, metadata.cssPaths[i]);
        }
        novel.setProperty(rt, "cssPaths", cssPaths);

        jsi::Array imagePaths(rt, metadata.imagePaths.size());
        for (int i = 0; i < metadata.imagePaths.size(); i++)
        {
            imagePaths.setValueAtIndex(rt, i, metadata.imagePaths[i]);
        }
        novel.setProperty(rt, "imagePaths", imagePaths);

        return novel;
    }

} // namespace facebook::react