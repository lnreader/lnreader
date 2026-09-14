const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.]*)?$/;
const EXPECTED_OUTPUTS = new Set([
  'arm64-v8a',
  'armeabi-v7a',
  'x86',
  'x86_64',
  'universal',
]);

const projectRoot = path.join(__dirname, '..');
const apkOutputDir = path.join(
  projectRoot,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
);
const artifactDir = path.join(projectRoot, 'release-artifacts');
const metadataPath = path.join(apkOutputDir, 'output-metadata.json');
const version = process.argv[2];

if (!VERSION_PATTERN.test(version || '')) {
  console.error('Usage: node scripts/package-release-artifacts.cjs <version>');
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const packagedOutputs = new Set();
const checksums = [];

const mismatchedVersion = metadata.elements?.find(
  element => element.versionName !== version,
);

if (mismatchedVersion) {
  console.error(
    `APK version ${mismatchedVersion.versionName} does not match requested release ${version}`,
  );
  process.exit(1);
}

fs.rmSync(artifactDir, { recursive: true, force: true });
fs.mkdirSync(artifactDir, { recursive: true });

for (const element of metadata.elements || []) {
  const abiFilter = element.filters?.find(
    filter => filter.filterType === 'ABI',
  );
  const outputName = abiFilter?.value || 'universal';

  if (!EXPECTED_OUTPUTS.has(outputName)) {
    continue;
  }

  const sourcePath = path.join(apkOutputDir, element.outputFile);
  const artifactName = `LNReader-v${version}-${outputName}.apk`;
  const artifactPath = path.join(artifactDir, artifactName);

  fs.copyFileSync(sourcePath, artifactPath);

  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(artifactPath))
    .digest('hex');

  checksums.push(`${hash}  ${artifactName}`);
  packagedOutputs.add(outputName);
}

const missingOutputs = [...EXPECTED_OUTPUTS].filter(
  outputName => !packagedOutputs.has(outputName),
);

if (missingOutputs.length > 0) {
  console.error(`Missing release APK outputs: ${missingOutputs.join(', ')}`);
  process.exit(1);
}

checksums.sort();
fs.writeFileSync(
  path.join(artifactDir, 'SHA256SUMS.txt'),
  `${checksums.join('\n')}\n`,
  'utf8',
);

console.table(
  [...packagedOutputs].sort().map(outputName => {
    const artifactName = `LNReader-v${version}-${outputName}.apk`;
    const stats = fs.statSync(path.join(artifactDir, artifactName));

    return {
      output: outputName,
      artifact: artifactName,
      sizeMiB: (stats.size / 1024 / 1024).toFixed(2),
    };
  }),
);
