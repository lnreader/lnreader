const { withDangerousMod } = require('@expo/config-plugins');
const { execFileSync } = require('child_process');
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

      // The web reader bundle is generated (not committed).
      execFileSync(
        process.execPath,
        [path.join(projectRoot, 'scripts', 'build-reader.mjs')],
        { stdio: 'inherit', cwd: projectRoot },
      );

      for (const subdir of ['fonts', 'app']) {
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
