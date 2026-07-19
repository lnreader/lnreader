const {
  withAndroidColors,
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
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.DOWNLOAD_WITHOUT_NOTIFICATION',
      'android.permission.FOREGROUND_SERVICE',
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

    // Application attributes
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    if (app.$) {
      app.$['android:largeHeap'] = 'true';
      app.$['android:allowBackup'] = 'true';
      app.$['android:usesCleartextTraffic'] = 'true';
    }

    // Notification metadata
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      'expo.modules.notifications.default_notification_color',
      '@color/notification_icon_color',
      'resource'
    );
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      'expo.modules.notifications.default_notification_icon',
      '@drawable/notification_icon',
      'resource'
    );

    // RNBackgroundActionsTask service
    let hasBgActions = false;
    const services = app['service'] || [];
    for (const s of services) {
      if (
        s.$ &&
        s.$['android:name'] ===
          'com.asterinet.react.bgactions.RNBackgroundActionsTask'
      ) {
        hasBgActions = true;
      }
    }
    if (!hasBgActions) {
      services.push({
        $: {
          'android:name':
            'com.asterinet.react.bgactions.RNBackgroundActionsTask',
          'android:foregroundServiceType': 'shortService',
        },
      });
      app['service'] = services;
    }

    // Deep link intent-filter on MainActivity
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    const intentFilters = mainActivity['intent-filter'] || [];
    let hasLnreaderFilter = false;
    for (const filter of intentFilters) {
      const dataNodes = filter['data'] || [];
      for (const d of dataNodes) {
        if (d.$ && d.$['android:scheme'] === 'lnreader') {
          hasLnreaderFilter = true;
        }
      }
    }
    if (!hasLnreaderFilter) {
      intentFilters.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        category: [
          { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
        ],
        data: [{ $: { 'android:scheme': 'lnreader' } }],
      });
      mainActivity['intent-filter'] = intentFilters;
    }

    return config;
  });
};

// ---------- 3b. android/app/build.gradle ----------

const withBuildGradleCustomizations = (config) => {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // applicationId
    contents = contents.replace(
      /applicationId\s+'[^']*'/,
      "applicationId 'com.rajarsheechatterjee.LNReader'"
    );

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

const KOTLIN_IMPORTS = `import android.view.KeyEvent
import expo.modules.nativevolumebuttonlistener.NativeVolumeButtonListenerModule`;

const KOTLIN_CUTOUT = `    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      window.attributes.layoutInDisplayCutoutMode =
        android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }`;

// ---------- 3d. colors.xml ----------

const withColorsCustomizations = (config) => {
  return withAndroidColors(config, (config) => {
    const colors = config.modResults;
    AndroidConfig.Colors.setColorItem(
      { $: { name: 'notification_icon_color' }, _: '#1D1B20' },
      colors
    );
    return config;
  });
};

const KOTLIN_DISPATCH_KEY = `  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (NativeVolumeButtonListenerModule.isActive) {
      val action = event.action
      return when (event.keyCode) {
        KeyEvent.KEYCODE_VOLUME_UP -> {
          if (action == KeyEvent.ACTION_DOWN) {
            NativeVolumeButtonListenerModule.sendEvent(true)
          }
          true
        }

        KeyEvent.KEYCODE_VOLUME_DOWN -> {
          if (action == KeyEvent.ACTION_DOWN) {
            NativeVolumeButtonListenerModule.sendEvent(false)
          }
          true
        }

        else -> super.dispatchKeyEvent(event)
      }
    }
    return super.dispatchKeyEvent(event)
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

      // 1. Add imports after the last existing import line
      if (
        !content.includes(
          'import expo.modules.nativevolumebuttonlistener.NativeVolumeButtonListenerModule'
        )
      ) {
        const lines = content.split('\n');
        let lastImportIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('import ')) {
            lastImportIdx = i;
          }
        }
        if (lastImportIdx >= 0) {
          lines.splice(lastImportIdx + 1, 0, KOTLIN_IMPORTS);
          content = lines.join('\n');
        }
      }

      // 2. Insert cutout mode near the top of onCreate
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

      // 3. Insert dispatchKeyEvent before getMainComponentName
      if (
        !content.includes('dispatchKeyEvent') &&
        content.includes('override fun getMainComponentName')
      ) {
        content = content.replace(
          /(^\s*override fun getMainComponentName)/m,
          `${KOTLIN_DISPATCH_KEY}\n\n$1`
        );
      }

      fs.writeFileSync(mainActivityPath, content);
      return config;
    },
  ]);
};

// ---------- Composed plugin ----------

const withAndroidCustomizations = (config) => {
  config = withManifestCustomizations(config);
  config = withColorsCustomizations(config);
  config = withBuildGradleCustomizations(config);
  config = withMainActivityCustomizations(config);
  return config;
};

module.exports = withAndroidCustomizations;
