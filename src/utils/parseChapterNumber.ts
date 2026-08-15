import isNil from 'lodash-es/isNil';

export const parseChapterNumber = (
  novelName: string,
  chapterName: string,
  chapterNumber?: number,
): number => {
  if (chapterNumber != null && chapterNumber > -1) {
    return chapterNumber;
  }

  const basic = new RegExp(/(?<=ch[^\d]*[\s]*)([0-9]+)(\.[0-9]+)?(\.?[a-z]+)?/);
  const number = new RegExp(/([0-9]+)(\.[0-9]+)?(\.?[a-z]+)?/);
  const unwantedWhiteSpace = new RegExp(/\s(?=extra|special|omake)/g);
  const unwanted = new RegExp(
    /\b(?:v|ver|vol|version|volume|season|s)[^a-z]?[0-9]+/g,
  );
  let name = chapterName.toLowerCase();
  name = name.replace(novelName.toLowerCase(), '').trim();
  name = name.replace(',', '.').replace('-', '.');
  name = name.replace(unwantedWhiteSpace, '');
  name = name.replace(unwanted, '');

  const basicMatch = name.match(basic);

  if (basicMatch?.length) {
    const chapNo = getChapterNumberFromMatch(basicMatch);

    if (!isNil(chapNo)) {
      return chapNo;
    }
  }

  const numberMatch = name.match(number);
  if (numberMatch?.length) {
    const chapNo = getChapterNumberFromMatch(numberMatch);

    if (!isNil(chapNo)) {
      return chapNo;
    }
  }

  return chapterNumber ?? -1;
};

const getChapterNumberFromMatch = (
  match: RegExpMatchArray | null,
): number | undefined => {
  if (match) {
    const initial = Number(match[1]);

    const subChapterDecimal = match[2];
    const subChapterAlpha = match[3];

    const addition = checkForDecimal(subChapterDecimal, subChapterAlpha);

    const chapterNumber = initial + addition;

    return chapterNumber;
  }
};

const checkForDecimal = (decimal?: string, alpha?: string): number => {
  if (!isNil(decimal)) {
    return Number(decimal);
  }

  if (!isNil(alpha)) {
    if (alpha.includes('extra')) {
      return 0.99;
    }

    if (alpha.includes('omake')) {
      return 0.98;
    }

    if (alpha.includes('special')) {
      return 0.97;
    }

    const trimmedAlpha = alpha.slice(1);

    if (trimmedAlpha.length === 1) {
      return parseAlphaPostFix(trimmedAlpha[0]);
    }
  }

  return 0.0;
};

export const parseAlphaPostFix = (alpha: string): number => {
  const number = alpha.charCodeAt(0) - ('a'.charCodeAt(0) - 1);

  if (number >= 10) {
    return 0;
  }

  return number / 10;
};
