cmake_minimum_required(VERSION 3.13)
project(nitro_epub)

find_package(ReactAndroid REQUIRED CONFIG)
find_package(react-native-nitro-modules REQUIRED CONFIG)

add_library(${CMAKE_PROJECT_NAME} SHARED
  ../cpp/EpubHybridObject.cpp
  ../cpp/EpubParser.cpp
  ../cpp/pugixml.cpp
  ../cpp/EpubInit.cpp
)

target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE ../cpp)

target_link_libraries(${CMAKE_PROJECT_NAME}
  react-native-nitro-modules::NitroModules
  ReactAndroid::jsi
  ReactAndroid::reactnative
)
