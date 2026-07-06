const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withReaderAssets = (config) => {
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;
      const assetsDir = path.join(platformRoot, 'app', 'src', 'main', 'assets');
      const sourceRoot = path.join(projectRoot, 'assets', 'reader');

      fs.mkdirSync(assetsDir, { recursive: true });

      for (const subdir of ['css', 'js', 'fonts']) {
        const src = path.join(sourceRoot, subdir);
        const dest = path.join(assetsDir, subdir);
        if (fs.existsSync(src)) {
          fs.cpSync(src, dest, { recursive: true });
        }
      }

      return config;
    },
  ]);

  return config;
};

module.exports = withReaderAssets;
