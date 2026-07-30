const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function parseArgs(argv) {
  const out = {};

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith('--')) {
      continue;
    }

    const eqIndex = token.indexOf('=');

    if (eqIndex !== -1) {
      out[token.slice(2, eqIndex)] = token.slice(eqIndex + 1);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];

    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }

  return out;
}

function formatUtcDate(date) {
  const pad = n => String(n).padStart(2, '0');

  const day = pad(date.getUTCDate());
  const month = pad(date.getUTCMonth() + 1);
  const year = String(date.getUTCFullYear()).slice(-2);

  let hours = date.getUTCHours();
  const minutes = pad(date.getUTCMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours %= 12;
  if (hours === 0) {
    hours = 12;
  }

  return `${day}/${month}/${year} ${pad(hours)}:${minutes} ${ampm} UTC`;
}

function getGitHash() {
  return execSync('git rev-parse --short HEAD').toString().trim();
}

function readEnvValue(filePath, key) {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const line = fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .find(entry => entry.startsWith(`${key}=`));

  if (!line) {
    return undefined;
  }

  const value = line.slice(key.length + 1).trim();

  if (!value || value === 'undefined') {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(value);
    return typeof parsedValue === 'string' ? parsedValue : value;
  } catch {
    return value;
  }
}

function resolveOptionalValue({ argument, existingValue, environmentValue }) {
  const value = argument ?? existingValue ?? environmentValue;

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true) {
    throw new Error('Expected a value after the client ID argument');
  }

  return String(value);
}

function formatEnvEntry(key, value) {
  return value === undefined ? undefined : `${key}=${JSON.stringify(value)}`;
}

function formatTypeScriptValue(value) {
  return JSON.stringify(value) ?? 'undefined';
}

function writeFileAtomically(filePath, content) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;

  try {
    fs.writeFileSync(temporaryPath, content, 'utf8');
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.rmSync(temporaryPath);
    }
  }
}

function getHiddenEnvFiles(rootDir) {
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter(entry => {
      return (
        entry.isFile() &&
        /^\..*\.env$/.test(entry.name) &&
        entry.name !== '.env'
      );
    })
    .map(entry => path.join(rootDir, entry.name))
    .sort();
}

function readHiddenEnvFiles(rootDir) {
  const files = getHiddenEnvFiles(rootDir);

  const content = files
    .map(filePath => {
      const fileName = path.basename(filePath);
      const fileContent = fs.readFileSync(filePath, 'utf8').trimEnd();

      return `# Imported from ${fileName}\n${fileContent}`;
    })
    .join('\n\n');

  return { files, content };
}

const args = parseArgs(process.argv);
const projectRoot = path.join(__dirname, '..');
const envFilePath = path.join(projectRoot, '.env');

const buildType = args['build-type'] || 'Beta';
const myanimelistClientId = resolveOptionalValue({
  argument: args['myanimelist-client-id'],
  existingValue: readEnvValue(envFilePath, 'MYANIMELIST_CLIENT_ID'),
  environmentValue: process.env.MYANIMELIST_CLIENT_ID,
});
const anilistClientId = resolveOptionalValue({
  argument: args['anilist-client-id'],
  existingValue: readEnvValue(envFilePath, 'ANILIST_CLIENT_ID'),
  environmentValue: process.env.ANILIST_CLIENT_ID,
});

const gitHash = args['git-hash'] || getGitHash();
const releaseDate = args['release-date'] || formatUtcDate(new Date());
const nodeEnv =
  args['node-env'] ||
  (buildType.toLowerCase().includes('release') ? 'production' : 'development');
const rozeniteEnabled = nodeEnv !== 'production';

const generatedEnvContent = [
  formatEnvEntry('BUILD_TYPE', buildType),
  formatEnvEntry('GIT_HASH', gitHash),
  formatEnvEntry('RELEASE_DATE', releaseDate),
  formatEnvEntry('NODE_ENV', nodeEnv),
  formatEnvEntry('WITH_ROZENITE', rozeniteEnabled),
  formatEnvEntry('MYANIMELIST_CLIENT_ID', myanimelistClientId),
  formatEnvEntry('ANILIST_CLIENT_ID', anilistClientId),
  '',
]
  .filter(value => value !== undefined)
  .join('\n');

const { files: hiddenEnvFiles, content: hiddenEnvContent } =
  readHiddenEnvFiles(projectRoot);

const envContent = hiddenEnvContent
  ? `${generatedEnvContent}\n# Imported hidden env files\n${hiddenEnvContent}\n`
  : generatedEnvContent;

const buildInfoPath = path.join(
  projectRoot,
  'src',
  'generated',
  'build-info.ts',
);

const buildInfoContent = `// This file is generated. Do not edit manually.
export const BUILD_TYPE = ${JSON.stringify(buildType)};
export const GIT_HASH = ${JSON.stringify(gitHash)};
export const RELEASE_DATE = ${JSON.stringify(releaseDate)};
export const NODE_ENV = ${JSON.stringify(nodeEnv)};
export const MYANIMELIST_CLIENT_ID: string | undefined = ${formatTypeScriptValue(
  myanimelistClientId,
)};
export const ANILIST_CLIENT_ID: string | undefined = ${formatTypeScriptValue(
  anilistClientId,
)};

export default {
  BUILD_TYPE,
  GIT_HASH,
  RELEASE_DATE,
  NODE_ENV,
  MYANIMELIST_CLIENT_ID,
  ANILIST_CLIENT_ID,
};
`;

try {
  fs.mkdirSync(path.dirname(buildInfoPath), { recursive: true });
  writeFileAtomically(buildInfoPath, buildInfoContent);
  writeFileAtomically(envFilePath, envContent);

  console.log(`Generated build environment for ${buildType} build`);
  console.log(
    `Wrote ${path.relative(projectRoot, envFilePath)} and ${path.relative(
      projectRoot,
      buildInfoPath,
    )}`,
  );

  if (hiddenEnvFiles.length > 0) {
    console.log(
      `Imported ${hiddenEnvFiles.length} hidden environment file(s):`,
      hiddenEnvFiles.map(filePath => path.basename(filePath)),
    );
  }

  console.table({
    BUILD_TYPE: buildType,
    GIT_HASH: gitHash,
    RELEASE_DATE: releaseDate,
    NODE_ENV: nodeEnv,
    WITH_ROZENITE: rozeniteEnabled ? 'enabled' : 'disabled',
    MYANIMELIST_CLIENT_ID: myanimelistClientId
      ? 'configured'
      : 'not configured',
    ANILIST_CLIENT_ID: anilistClientId ? 'configured' : 'not configured',
  });
} catch (err) {
  console.error('Error: Could not generate build environment:', err.message);
  process.exit(1);
}
