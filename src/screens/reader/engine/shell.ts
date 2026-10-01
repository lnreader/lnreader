export const READER_SCRIPT_PATH = 'app/reader.js';

// Chapters arrive through the bridge, so this markup never changes (a new
// `source` would reload the WebView).
export const buildShellHtml = (assetsUri: string, background: string) => {
  const color = /^[#\w\s(),.%-]+$/.test(background) ? background : '#000';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
html, body { margin: 0; height: 100%; overflow: hidden; background: ${color}; }
#reader { position: fixed; inset: 0; }
foliate-paginator { width: 100%; height: 100%; }
foliate-paginator::part(head), foliate-paginator::part(foot) {
  font: 12px/16px system-ui, sans-serif; opacity: 0.6;
}
#ln-status {
  position: fixed; left: 0; right: 0; bottom: 0;
  padding: 2px 12px 4px; text-align: center;
  font: 12px/16px system-ui, sans-serif;
  /* Only the text is dimmed: the text scrolling under the line stays hidden,
     and the page colour follows theme changes. */
  color: color-mix(in srgb, currentColor 60%, transparent);
  pointer-events: none; background: inherit;
}
#ln-status[hidden] { display: none; }
#ln-image {
  position: fixed; inset: 0; z-index: 10; display: flex;
  align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.9);
}
#ln-image[hidden] { display: none; }
#ln-image img { max-width: 100%; max-height: 100%; object-fit: contain; }
</style>
</head>
<body>
<div id="reader"></div>
<div id="ln-status" hidden></div>
<script src="${assetsUri}/${READER_SCRIPT_PATH}"></script>
</body>
</html>`;
};
