const { withRozenite } = require('@rozenite/metro');
const { withRozeniteExpoAtlasPlugin } = require('@rozenite/expo-atlas-plugin');

const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);
const readerAssetsRoot = path.resolve(__dirname, 'assets', 'reader');
const readerAssetContentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ttf': 'font/ttf',
};

config.resolver.sourceExts.push('sql');

config.server.enhanceMiddleware = metroMiddleware => {
  return (request, response, next) => {
    let pathname;

    try {
      pathname = decodeURIComponent(
        new URL(request.url, 'http://localhost').pathname,
      );
    } catch {
      return metroMiddleware(request, response, next);
    }

    if (!pathname.startsWith('/assets/')) {
      return metroMiddleware(request, response, next);
    }

    const assetPath = path.resolve(
      readerAssetsRoot,
      pathname.slice('/assets/'.length),
    );
    const isReaderAsset =
      assetPath.startsWith(`${readerAssetsRoot}${path.sep}`) &&
      fs.existsSync(assetPath) &&
      fs.statSync(assetPath).isFile();

    if (!isReaderAsset) {
      return metroMiddleware(request, response, next);
    }

    response.setHeader(
      'Content-Type',
      readerAssetContentTypes[path.extname(assetPath)] ||
        'application/octet-stream',
    );

    if (request.method === 'HEAD') {
      return response.end();
    }

    fs.createReadStream(assetPath).pipe(response);
  };
};

module.exports = withRozenite(config, {
  enabled: process.env.WITH_ROZENITE === 'true',
  enhanceMetroConfig: metroConfig => withRozeniteExpoAtlasPlugin(metroConfig),
});
