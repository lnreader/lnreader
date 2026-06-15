function removeExtraParagraphSpacing(html) {
  return html
    .replace(/(?:&nbsp;\s*|[\u200b]\s*)+(?=<\/?p[> ])/g, '')
    .replace(/<br>\s*<br>\s*(?:<br>\s*)+/g, '<br><br>') //force max 2 consecutive <br>, chaining regex
    .replace(
      /<br>\s*<br>[^]+/,
      _ =>
        `${
          /\/p>/.test(_)
            ? _.replace(
                /<br>\s*<br>(?:(?=\s*<\/?p[> ])|(?<=<\/?p\b[^>]*><br>\s*<br>))\s*/g,
                '',
              )
            : _
        }`,
    ) //if p found, delete all double br near p
    .replace(/<br>(?:(?=\s*<\/?p[> ])|(?<=<\/?p\b[^>]*>(?:<[^>]+>)*\s*<br>))\s*/g, '');
}

// WebView global
if (typeof window !== 'undefined') {
  window.removeExtraParagraphSpacing = removeExtraParagraphSpacing;
}

// Node / test
if (typeof module !== 'undefined' && module.exports) {
  module.exports = removeExtraParagraphSpacing;
}
