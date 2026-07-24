const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

config.server.enhanceMiddleware = (middleware, _server) => {
  return (req, res, next) => {
    const cssMatch = req.url?.match(/^\/assets\/css\/(.+\.css)$/);
    const jsMatch = req.url?.match(/^\/assets\/js\/(.+\.js)$/);

    if (cssMatch || jsMatch) {
      const subdir = cssMatch ? 'css' : 'js';
      const filePath = path.join(__dirname, 'assets', 'reader', subdir, cssMatch?.[1] ?? jsMatch?.[1]);
      try {
        const content = fs.readFileSync(filePath);
        res.setHeader('Content-Type', cssMatch ? 'text/css' : 'application/javascript');
        res.end(content);
        return;
      } catch {
        // not found, fall through to default handling
      }
    }

    return middleware(req, res, next);
  };
};

config.resolver.sourceExts.push('sql');

module.exports = config;
