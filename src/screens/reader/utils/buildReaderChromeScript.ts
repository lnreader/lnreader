export function buildReaderChromeScript(
  hidden: boolean,
  searchVisible: boolean,
) {
  return `if (window.reader?.hidden) { window.reader.hidden.val = ${
    hidden || searchVisible
  }; } true;`;
}
