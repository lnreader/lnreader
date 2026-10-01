// Material symbols are Android vector drawables; in tests each one becomes
// its name, so assertions can tell icons apart.
const path = require('path');

module.exports = {
  process(_source, filename) {
    return {
      code: `module.exports = ${JSON.stringify(
        path.basename(filename, '.xml'),
      )};`,
    };
  },
};
