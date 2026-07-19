#pragma once

#include <LNReaderSpecJSI.h>
#include <string>
#include <Epub.hpp>

namespace facebook::react
{

    class NativeEpub : public NativeEpubCxxSpec<NativeEpub>
    {
    public:
        NativeEpub(std::shared_ptr<CallInvoker> jsInvoker);

        jsi::Object parseNovelAndChapters(jsi::Runtime &rt, jsi::String epubDirPath);
    };

} // namespace facebook::react
