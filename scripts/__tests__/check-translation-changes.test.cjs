const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  flatten,
  isTranslation,
  validateTranslation,
} = require('../check-translation-changes.cjs');

test('only synced locale catalogs qualify for skipping heavy checks', () => {
  assert.equal(isTranslation('src/i18n/languages/id_ID/strings.json'), true);
  for (const file of [
    'src/i18n/languages/en/strings.json',
    'src/i18n/languages/id_ID/index.ts',
    'src/screens/Reader.tsx',
    'crowdin.yml',
  ]) {
    assert.equal(isTranslation(file), false);
  }
});

test('catalogs require string leaves and object containers', () => {
  assert.deepEqual(flatten({ group: { name: 'Name' } }), {
    'group.name': 'Name',
  });
  for (const value of [null, [], { name: 42 }, { name: null }]) {
    assert.throws(() => flatten(value));
  }
});

test('changed translations must preserve placeholder names', () => {
  const source = { greeting: 'Hello %{name}' };
  assert.deepEqual(
    validateTranslation(source, {}, { greeting: 'Halo %{name}' }),
    [],
  );
  for (const text of ['Halo', 'Halo %{user}', 'Halo %{name} %{extra}']) {
    assert.match(
      validateTranslation(source, {}, { greeting: text })[0],
      /placeholders/,
    );
  }
});

test('new plural forms use the English other form', () => {
  assert.deepEqual(
    validateTranslation(
      { 'chapters.other': '%{count} chapters' },
      {},
      { 'chapters.few': '%{count} kapitoly' },
    ),
    [],
  );
});

test('rejects accidental trailing newlines but allows intentional multiline text', () => {
  assert.match(
    validateTranslation({ read: 'Read' }, {}, { read: 'Baca\n' })[0],
    /trailing newline/,
  );
  assert.deepEqual(
    validateTranslation({ read: 'Read\n' }, {}, { read: 'Baca\n' }),
    [],
  );
  assert.deepEqual(
    validateTranslation({ read: 'Read\nnow' }, {}, { read: 'Baca\nsekarang' }),
    [],
  );
});

test('unchanged translation debt and missing translations do not block a sync', () => {
  assert.deepEqual(
    validateTranslation(
      { greeting: 'Hello %{name}', untranslated: 'Missing' },
      { greeting: 'Halo' },
      { greeting: 'Halo' },
    ),
    [],
  );
  assert.match(
    validateTranslation({}, {}, { unknown: 'Unknown' })[0],
    /missing English/,
  );
});

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-translations-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = args =>
    execFileSync(
      'git',
      ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args],
      { cwd: root, encoding: 'utf8', timeout: 10000 },
    ).trim();
  const write = (file, content) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  const commit = () => {
    git(['add', '.']);
    git([
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-qm',
      'Fixture',
    ]);
    return git(['rev-parse', 'HEAD']);
  };
  git(['init', '-q']);
  write('src/i18n/languages/en/strings.json', '{"greeting":"Hello %{name}"}');
  write('src/i18n/languages/id_ID/strings.json', '{"greeting":"Halo %{name}"}');
  const base = commit();
  const run = (comparisonBase = base) => {
    const output = path.join(root, '.git', 'check-output');
    fs.writeFileSync(output, '');
    const result = spawnSync(
      process.execPath,
      [path.resolve(__dirname, '../check-translation-changes.cjs')],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          BASE_SHA: comparisonBase,
          HEAD_SHA: 'HEAD',
          GITHUB_OUTPUT: output,
        },
      },
    );
    return { ...result, output: fs.readFileSync(output, 'utf8') };
  };
  return { write, commit, run, git };
}

test('translation-only diffs skip heavy jobs and mixed changes keep them', t => {
  const repo = fixture(t);
  repo.write(
    'src/i18n/languages/id_ID/strings.json',
    '{"greeting":"Hai %{name}"}',
  );
  repo.commit();
  assert.equal(repo.run().status, 0);
  assert.equal(repo.run().output, 'translation_only=true\n');
  repo.write('src/app.ts', 'export const changed = true;');
  repo.commit();
  assert.equal(repo.run().output, 'translation_only=false\n');
});

test('an English source change runs full checks', t => {
  const repo = fixture(t);
  repo.write('src/i18n/languages/en/strings.json', '{"greeting":"Hi %{name}"}');
  repo.commit();
  assert.equal(repo.run().output, 'translation_only=false\n');
});

test('deleted locale files and new locales are handled', t => {
  const repo = fixture(t);
  repo.git(['rm', 'src/i18n/languages/id_ID/strings.json']);
  repo.write(
    'src/i18n/languages/fr_FR/strings.json',
    '{"greeting":"Bonjour %{name}"}',
  );
  repo.commit();
  const result = repo.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'translation_only=true\n');
});

test('invalid JSON and broken translations fail the lightweight check', t => {
  const repo = fixture(t);
  for (const content of [
    '{',
    '{"greeting":"Halo"}',
    '{"greeting":"Halo %{name}\\n"}',
  ]) {
    repo.write('src/i18n/languages/id_ID/strings.json', content);
    repo.commit();
    assert.equal(repo.run().status, 1);
  }
});

test('missing comparison bases and empty diffs keep full checks', t => {
  const repo = fixture(t);
  assert.equal(repo.run().output, 'translation_only=false\n');
  assert.equal(repo.run('0'.repeat(40)).output, 'translation_only=false\n');
  assert.equal(repo.run('f'.repeat(40)).output, 'translation_only=false\n');
});
