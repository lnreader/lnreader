/**
 * Decodes a URL-encoded path, returns original if decoding fails.
 */
export const decodePath = (path: string) => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};

/**
 * Converts backslashes to forward slashes (Windows to Unix path).
 */
export const normalizePath = (path: string) => path.replace(/\\/g, '/');

/**
 * Removes 'file://' prefix from path if present.
 */
const stripFileScheme = (path: string) =>
  path.startsWith('file://') ? path.slice('file://'.length) : path;

/**
 * Resolves a relative path against a base directory, handling '..' and '.'.
 */
const resolvePath = (baseDir: string, relativePath: string) => {
  const normalizedBase = normalizePath(stripFileScheme(baseDir)).replace(
    /\/+$/,
    '',
  );
  const baseSegments = normalizedBase ? normalizedBase.split('/') : [];
  const normalizedRelative = normalizePath(stripFileScheme(relativePath));

  for (const segment of normalizedRelative.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      baseSegments.pop();
      continue;
    }
    baseSegments.push(segment);
  }

  return baseSegments.join('/');
};

/**
 * Resolves an asset path (image, css) relative to the chapter or epub root.
 */
export const resolveAssetPath = (
  epubRootPath: string,
  chapterPath: string,
  assetPath: string,
) => {
  const normalizedAssetPath = normalizePath(stripFileScheme(assetPath));
  if (!normalizedAssetPath) {
    return '';
  }
  if (normalizedAssetPath.startsWith('/')) {
    return resolvePath(epubRootPath, normalizedAssetPath.slice(1));
  }
  const chapterDir = getParentDir(chapterPath);
  return resolvePath(chapterDir, normalizedAssetPath);
};

/**
 * Gets the parent directory of a path.
 */
export const getParentDir = (path: string) => {
  const normalized = normalizePath(stripFileScheme(path)).replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '';
};

/**
 * Gets the relative path from root to full path.
 */
export const getRelativePath = (rootPath: string, fullPath: string) => {
  const normalizedRoot = normalizePath(stripFileScheme(rootPath)).replace(
    /\/+$/,
    '',
  );
  const normalizedFull = normalizePath(stripFileScheme(fullPath));

  if (!normalizedRoot) {
    return '';
  }

  if (normalizedFull === normalizedRoot) {
    return '';
  }

  if (normalizedFull.startsWith(`${normalizedRoot}/`)) {
    return normalizedFull.slice(normalizedRoot.length + 1);
  }

  return '';
};

/**
 * Extracts file extension from path (lowercase).
 */
export const getExtension = (path: string) => {
  const match = path.match(/\.([^.\/?#]+)$/);
  return match ? match[1].toLowerCase() : '';
};

/**
 * Checks if URL should be skipped during rewrite (anchors, external URLs).
 */
export const shouldSkipUrlRewrite = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return true;
  }
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
};

/**
 * Removes HTML tags and normalizes whitespace.
 */
const stripHtml = (value: string) => {
  const bodyMatch = value.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : value;
  return bodyContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Converts HTML content to lowercase plain text.
 */
const normalizeText = (value: string) => stripHtml(value).toLowerCase();

/**
 * Escapes special regex characters in a string.
 */
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Checks if chapter name is derived from base name (e.g., "Chapter 1 (2)").
 */
export const isDerivedName = (name: string, base: string) => {
  const normalizedName = name.trim().toLowerCase();
  const normalizedBase = base.trim().toLowerCase();
  if (!normalizedName || !normalizedBase) {
    return false;
  }
  if (normalizedName === normalizedBase) {
    return true;
  }
  const pattern = new RegExp(`^${escapeRegExp(normalizedBase)}\\s*\\(\\d+\\)$`);
  return pattern.test(normalizedName);
};

/**
 * Checks if chapter contains only title text (no real content).
 */
export const isTitleOnlyChapter = (
  chapterName: string,
  chapterText: string,
) => {
  if (!chapterName) {
    return false;
  }
  const normalizedName = normalizeText(chapterName);
  if (!normalizedName) {
    return false;
  }
  const normalizedText = normalizeText(chapterText);
  if (!normalizedText) {
    return false;
  }

  return (
    (normalizedText === normalizedName && normalizedText.length <= 80) ||
    normalizedText.length <= normalizedName.length
  );
};
