const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ---------- 3a. AndroidManifest.xml ----------

const withManifestCustomizations = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // Permissions
    const PERMS = [
      'android.permission.DOWNLOAD_WITHOUT_NOTIFICATION',
      'android.permission.WAKE_LOCK',
    ];
    for (const perm of PERMS) {
      AndroidConfig.Permissions.ensurePermission(manifest, perm);
    }

    // Remove android:maxSdkVersion from WRITE_EXTERNAL_STORAGE
    const usesPerms = manifest.manifest['uses-permission'] || [];
    for (const el of usesPerms) {
      if (
        el.$ &&
        el.$['android:name'] === 'android.permission.WRITE_EXTERNAL_STORAGE'
      ) {
        delete el.$['android:maxSdkVersion'];
        delete el.$['tools:replace'];
      }
    }



    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    if (app.$) {
      app.$['android:largeHeap'] = 'true';
      app.$['android:allowBackup'] = 'true';
    }

    // RNBackgroundActionsTask service — ensure foregroundServiceType is set
    let found = false;
    const services = app['service'] || [];
    for (const s of services) {
      if (
        s.$ &&
        s.$['android:name'] ===
          'com.asterinet.react.bgactions.RNBackgroundActionsTask'
      ) {
        s.$['android:foregroundServiceType'] = 'dataSync';
        found = true;
        break;
      }
    }
    if (!found) {
      services.push({
        $: {
          'android:name':
            'com.asterinet.react.bgactions.RNBackgroundActionsTask',
          'android:foregroundServiceType': 'dataSync',
        },
      });
      app['service'] = services;
    }


    return config;
  });
};

// ---------- 3b. android/app/build.gradle ----------

const withBuildGradleCustomizations = (config) => {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;


    // Insert version vars after defaultConfig {
    if (
      !contents.includes('def versionMajor') &&
      contents.includes('defaultConfig {')
    ) {
      contents = contents.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {\n        def versionMajor = 2\n        def versionMinor = 0\n        def versionPatch = 3`
      );
    }

    // versionCode
    contents = contents.replace(
      /versionCode\s+\d+/,
      'versionCode ((((versionMajor << 10) | versionMinor) << 11) | versionPatch)'
    );

    // versionName
    contents = contents.replace(
      /versionName\s+'[^']*'/,
      'versionName "$versionMajor.$versionMinor.$versionPatch"'
    );

    // Insert preRelease build type after buildTypes {
    if (
      !contents.includes('preRelease {') &&
      contents.includes('buildTypes {')
    ) {
      contents = contents.replace(
        /buildTypes\s*\{/,
        `buildTypes {\n        preRelease {\n            initWith release\n            matchingFallbacks = ["release"]\n            applicationIdSuffix "preRelease"\n            versionNameSuffix "-pre-release"\n            signingConfig signingConfigs.debug\n        }`
      );
    }

    // Add suffix to debug build type
    if (
      contents.includes('debug {') &&
      !contents.includes('applicationIdSuffix "debug"')
    ) {
      contents = contents.replace(
        /(debug\s*\{[^}]*signingConfig\s+signingConfigs\.debug\s*\n)(\s*\})/s,
        '$1            applicationIdSuffix "debug"\n            versionNameSuffix "-debug"\n$2'
      );
    }

    // Insert deps after dependencies {
    if (
      !contents.includes('"androidx.core:core-ktx:') &&
      contents.includes('dependencies {')
    ) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation "androidx.core:core-ktx:1.15.0"\n    implementation "androidx.media:media:1.7.0"`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};

// ---------- 3c. MainActivity.kt ----------
const KOTLIN_CUTOUT = `    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      window.attributes.layoutInDisplayCutoutMode =
        android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }`;

const withMainActivityCustomizations = (config) => {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      const mainActivityPath = path.join(
        platformRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'rajarsheechatterjee',
        'LNReader',
        'MainActivity.kt'
      );

      if (!fs.existsSync(mainActivityPath)) {
        console.warn(
          `MainActivity.kt not found at ${mainActivityPath}, skipping customizations`
        );
        return config;
      }

      let content = fs.readFileSync(mainActivityPath, 'utf8');

      // Insert cutout mode near the top of onCreate
      if (!content.includes('layoutInDisplayCutoutMode')) {
        // Try setTheme anchor first; fall back to super.onCreate
        if (content.includes('setTheme(R.style.AppTheme)')) {
          content = content.replace(
            /(setTheme\(R\.style\.AppTheme\);?\s*[\r\n]+)/,
            `$1\n${KOTLIN_CUTOUT}\n`
          );
        } else if (content.includes('super.onCreate(')) {
          content = content.replace(
            /(super\.onCreate\([^)]*\)\s*[\r\n]+)/,
            `$1\n${KOTLIN_CUTOUT}\n`
          );
        }
      }

      fs.writeFileSync(mainActivityPath, content);
      return config;
    },
  ]);
};

// ---------- Composed plugin ----------

const withAndroidCustomizations = (config) => {
  config = withManifestCustomizations(config);
  config = withBuildGradleCustomizations(config);
  config = withMainActivityCustomizations(config);
  return config;
};

module.exports = withAndroidCustomizations;
