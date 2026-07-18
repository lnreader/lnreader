const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ---------- 3a. AndroidManifest.xml ----------

const withManifestCustomizations = config => {
  return withAndroidManifest(config, config => {
    const manifest = config.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    // RNBackgroundActionsTask service
    let found = false;
    const services = app['service'] || [];
    for (const s of services) {
      if (
        s.$ &&
        s.$['android:name'] ===
        'com.asterinet.react.bgactions.RNBackgroundActionsTask'
      ) {
        s.$['android:foregroundServiceType'] = 'dataSync';
        s.$['tools:replace'] = 'android:foregroundServiceType';
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
          'tools:replace': 'android:foregroundServiceType',
        },
      });
      app['service'] = services;
    }

    return config;
  });
};

// ---------- 3b. android/app/build.gradle ----------

const withBuildGradleCustomizations = config => {
  return withAppBuildGradle(config, config => {
    let contents = config.modResults.contents;

    // Insert preRelease build type after buildTypes {
    if (
      !contents.includes('preRelease {') &&
      contents.includes('buildTypes {')
    ) {
      contents = contents.replace(
        /buildTypes\s*\{/,
        `buildTypes {\n        preRelease {\n            initWith release\n            matchingFallbacks = ["release"]\n            applicationIdSuffix "preRelease"\n            versionNameSuffix "-pre-release"\n            signingConfig signingConfigs.debug\n        }`,
      );
    }

    // Add suffix to debug build type
    if (
      contents.includes('debug {') &&
      !contents.includes('applicationIdSuffix "debug"')
    ) {
      contents = contents.replace(
        /(debug\s*\{[^}]*signingConfig\s+signingConfigs\.debug\s*\n)(\s*\})/s,
        '$1            applicationIdSuffix "debug"\n            versionNameSuffix "-debug"\n$2',
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};


// ---------- Composed plugin ----------

const withAndroidCustomizations = config => {
  config = withManifestCustomizations(config);
  config = withBuildGradleCustomizations(config);
  return config;
};

module.exports = withAndroidCustomizations;
