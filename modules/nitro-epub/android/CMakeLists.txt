project(NitroEpub)
cmake_minimum_required(VERSION 3.9.0)

set (PACKAGE_NAME NitroEpub)
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

# Define C++ library and add all sources
add_library(${PACKAGE_NAME} SHARED
        src/main/cpp/cpp-adapter.cpp
        ../cpp/import/EpubChapterNormalizer.cpp
        ../cpp/import/EpubParser.cpp
        ../cpp/export/EpubContentProcessor.cpp
        ../cpp/export/EpubDocuments.cpp
        ../cpp/export/EpubExporter.cpp
        ../cpp/export/ZipWriter.cpp
        ../cpp/pugixml.cpp
        ../cpp/HybridEpub.cpp
)

# Add Nitrogen specs :)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroEpub+autolinking.cmake)

# Set up local includes
include_directories(
        "src/main/cpp"
        "../cpp"
)

find_library(LOG_LIB log)
find_library(Z_LIB z)

# Link all libraries together
target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        ${Z_LIB}
        android                                   # <-- Android core
)
