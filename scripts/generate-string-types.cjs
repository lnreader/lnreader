const fs = require('fs');
const path = require('path');
const prettier = require('prettier');
const prettierConfig = require('../.prettierrc');

const flatten = (obj, target, prefix) => {
  (target = target || {}), (prefix = prefix || '');

  Object.keys(obj).forEach(function (key) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      flatten(obj[key], target, prefix + key + '.');
    } else {
      return (target[prefix + key] = 'string');
    }
  });

  return target;
};

const strings = fs.readFileSync(
  path.resolve(process.cwd(), 'src/i18n/languages/en/strings.json'),
  'utf8',
);

const stringTypes = `/**\n * This file is auto-generated\n */\n\n

export interface StringMap ${JSON.stringify(flatten(JSON.parse(strings)))}

`;

const formatContent = prettier.format(stringTypes, {
  parser: 'typescript',
  ...prettierConfig,
});

fs.writeFile(
  path.resolve(process.cwd(), 'src/i18n/types/index.ts'),
  formatContent,
  err => {
    if (err) {
      console.log(err);
    }
  },
);
