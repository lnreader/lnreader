const FAMILY = /^[\w-]+$/;

export const fontFamilyValue = (family: string): string | undefined =>
  family && FAMILY.test(family) ? `"${family}"` : undefined;

export const fontFaceCss = (family: string, assetsUri: string): string =>
  fontFamilyValue(family)
    ? `@font-face { font-family: "${family}"; ` +
      `src: url("${assetsUri}/fonts/${family}.ttf"); font-display: block; }`
    : '';
