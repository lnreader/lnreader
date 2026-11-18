const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const sourcePath = 'src/i18n/languages/en/strings.json';
const isTranslation = file =>
  /^src\/i18n\/languages\/[^/]+\/strings\.json$/.test(file) &&
  file !== sourcePath;

function flatten(value, prefix = '', result = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${prefix || 'Root'} must be an object`);
  }
  for (const [key, entry] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === 'string') {
      result[name] = entry;
    } else {
      flatten(entry, name, result);
    }
  }
  return result;
}

const placeholders = text =>
  [...new Set(text.match(/%\{[^}]+\}/g) || [])].sort().join(',');

function validateTranslation(source, previous, current) {
  const errors = [];
  for (const [key, text] of Object.entries(current)) {
    // Existing translation debt should not block an unrelated sync.
    if (previous[key] === text) continue;
    const sourceKey = key.replace(/\.(zero|one|two|few|many|other)$/, '.other');
    const original = source[key] ?? source[sourceKey];
    if (original === undefined) {
      errors.push(`${key}: missing English source string`);
      continue;
    }
    if (placeholders(text) !== placeholders(original)) {
      errors.push(`${key}: interpolation placeholders differ from English`);
    }
    if (/\r?\n$/.test(text) && !/\r?\n$/.test(original)) {
      errors.push(`${key}: unexpected trailing newline`);
    }
  }
  return errors;
}

function main() {
  const base = process.env.BASE_SHA;
  const head = process.env.HEAD_SHA || 'HEAD';
  const git = args => execFileSync('git', args, { encoding: 'utf8' });
  let comparisonBase;
  // New branches or unavailable force-push bases must keep the full checks.
  if (base && !/^0+$/.test(base)) {
    try {
      comparisonBase = git(['merge-base', base, head]).trim();
    } catch {
      process.stdout.write(
        'Comparison base unavailable; running full checks.\n',
      );
    }
  }
  const changed = comparisonBase
    ? git(['diff', '--name-only', '-z', '--no-renames', comparisonBase, head])
        .split('\0')
        .filter(Boolean)
    : [];
  const translationOnly = changed.length > 0 && changed.every(isTranslation);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `translation_only=${translationOnly}\n`,
    );
  }
  const read = (ref, file) => JSON.parse(git(['show', `${ref}:${file}`]));
  const translations = changed.filter(isTranslation);
  const source = translations.length ? flatten(read(head, sourcePath)) : {};
  const existing = new Set(
    git(['ls-tree', '-r', '--name-only', '-z', head]).split('\0'),
  );
  const previousFiles = comparisonBase
    ? new Set(
        git(['ls-tree', '-r', '--name-only', '-z', comparisonBase]).split('\0'),
      )
    : new Set();
  const errors = [];
  for (const file of translations) {
    if (!existing.has(file)) continue;
    const previous = previousFiles.has(file)
      ? flatten(read(comparisonBase, file))
      : {};
    const current = flatten(read(head, file));
    errors.push(
      ...validateTranslation(source, previous, current).map(
        error => `${file}: ${error}`,
      ),
    );
  }
  if (errors.length) throw new Error(errors.join('\n'));
  process.stdout.write(
    `Validated ${translations.length} changed translation files. Translation only: ${translationOnly}.\n`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { flatten, isTranslation, validateTranslation };
