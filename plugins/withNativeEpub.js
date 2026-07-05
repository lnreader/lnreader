const { withProjectBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNativeEpub = (config) => {
  // Ensure CMake externalNativeBuild is present in android/app/build.gradle
  config = withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes('externalNativeBuild')) {
      config.modResults.contents = contents.replace(
        /android\s*\{/,
        `android {\n    externalNativeBuild {\n        cmake {\n            path "src/main/jni/CMakeLists.txt"\n        }\n    }`
      );
    }
    return config;
  });

  // Copy shared/ C++ source files into android/app/src/main/jni/ if not present
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

      // Copy shared C++ files to jni directory
      if (fs.existsSync(sharedDir)) {
        const sharedFiles = fs.readdirSync(sharedDir);
        for (const file of sharedFiles) {
          const src = path.join(sharedDir, file);
          const dest = path.join(jniDir, file);
          if (fs.statSync(src).isFile() && !fs.existsSync(dest)) {
            fs.copyFileSync(src, dest);
          }
        }
      }

      return config;
    },
  ]);

  return config;
};

module.exports = withNativeEpub;
