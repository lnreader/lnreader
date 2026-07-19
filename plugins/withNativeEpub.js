const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CMAKE_CONTENT = `cmake_minimum_required(VERSION 3.13)
project(appmodules)
set(CMAKE_VERBOSE_MAKEFILE ON)
include(\${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)
`;

const ONLOAD_CONTENT = `/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// This C++ file is part of the default configuration used by apps and is placed
// inside react-native to encapsulate it from user space (so you won't need to
// touch C++/Cmake code at all on Android).
//
// If you wish to customize it (because you want to manually link a C++ library
// or pass a custom compilation flag) you can:
//
// 1. Copy this CMake file inside the android/app/src/main/jni folder of your
// project
// 2. Copy the OnLoad.cpp (in this same folder) file inside the same folder as
// above.
// 3. Extend your android/app/build.gradle as follows
//
// android {
//    // Other config here...
//    externalNativeBuild {
//        cmake {
//            path "src/main/jni/CMakeLists.txt"
//        }
//    }
// }

#include <DefaultComponentsRegistry.h>
#include <DefaultTurboModuleManagerDelegate.h>
#include <autolinking.h>
#include <fbjni/fbjni.h>
#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>
#include <FBReactNativeSpec.h>
#include <NativeEpub.hpp>

#ifdef REACT_NATIVE_APP_CODEGEN_HEADER
#include REACT_NATIVE_APP_CODEGEN_HEADER
#endif
#ifdef REACT_NATIVE_APP_COMPONENT_DESCRIPTORS_HEADER
#include REACT_NATIVE_APP_COMPONENT_DESCRIPTORS_HEADER
#endif

namespace facebook::react
{

    void registerComponents(
        std::shared_ptr<const ComponentDescriptorProviderRegistry> registry)
    {
        // Custom Fabric Components go here. You can register custom
        // components coming from your App or from 3rd party libraries here.
        //
        // providerRegistry->add(concreteComponentDescriptorProvider<
        //        MyComponentDescriptor>());

        // We link app local components if available
#ifdef REACT_NATIVE_APP_COMPONENT_REGISTRATION
        REACT_NATIVE_APP_COMPONENT_REGISTRATION(registry);
#endif

        // And we fallback to the components autolinked
        autolinking_registerProviders(registry);
    }

    std::shared_ptr<TurboModule> cxxModuleProvider(
        const std::string &name,
        const std::shared_ptr<CallInvoker> &jsInvoker)
    {
        if (name == NativeEpub::kModuleName)
        {
            return std::make_shared<NativeEpub>(jsInvoker);
        }

        // And we fallback to the CXX module providers autolinked
        return autolinking_cxxModuleProvider(name, jsInvoker);
    }

    std::shared_ptr<TurboModule> javaModuleProvider(
        const std::string &name,
        const JavaTurboModule::InitParams &params)
    {
#ifdef REACT_NATIVE_APP_MODULE_PROVIDER
        auto module = REACT_NATIVE_APP_MODULE_PROVIDER(name, params);
        if (module != nullptr)
        {
            return module;
        }
#endif

        // We first try to look up core modules
        if (auto module = FBReactNativeSpec_ModuleProvider(name, params))
        {
            return module;
        }

        // And we fallback to the module providers autolinked
        if (auto module = autolinking_ModuleProvider(name, params))
        {
            return module;
        }

        return nullptr;
    }

} // namespace facebook::react

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *)
{
    return facebook::jni::initialize(vm, []
                                     {
    facebook::react::DefaultTurboModuleManagerDelegate::cxxModuleProvider =
        &facebook::react::cxxModuleProvider;
    facebook::react::DefaultTurboModuleManagerDelegate::javaModuleProvider =
        &facebook::react::javaModuleProvider;
    facebook::react::DefaultComponentsRegistry::
        registerComponentDescriptorsFromEntryPoint =
            &facebook::react::registerComponents; });
}
`;

const withNativeEpub = (config) => {
  // Inject externalNativeBuild { cmake { path ... } } into android/app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes('externalNativeBuild')) {
      // Insert after androidResources { ... } block
      config.modResults.contents = contents.replace(
        /androidResources\s*\{[^}]*\}/,
        (match) =>
          `${match}\n    externalNativeBuild {\n        cmake {\n            path "src/main/jni/CMakeLists.txt"\n        }\n    }`
      );
    }
    return config;
  });

  // Copy C++ sources from shared/ to android/app/src/main/jni/
  // Generate CMakeLists.txt and OnLoad.cpp
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const sharedDir = path.join(config.modRequest.projectRoot, 'shared');
      const jniDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'jni'
      );

      // Ensure jni directory exists
      fs.mkdirSync(jniDir, { recursive: true });

      // Copy shared C++ source files to jni directory
      if (fs.existsSync(sharedDir)) {
        const sharedFiles = fs.readdirSync(sharedDir);
        for (const file of sharedFiles) {
          const src = path.join(sharedDir, file);
          const dest = path.join(jniDir, file);
          if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest);
          }
        }
      }

      // Write CMakeLists.txt
      fs.writeFileSync(path.join(jniDir, 'CMakeLists.txt'), CMAKE_CONTENT);

      // Write OnLoad.cpp with NativeEpub registration
      fs.writeFileSync(path.join(jniDir, 'OnLoad.cpp'), ONLOAD_CONTENT);

      return config;
    },
  ]);

  return config;
};

module.exports = withNativeEpub;
