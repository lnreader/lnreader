const VIEWPORT_LOCKED =
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
const VIEWPORT_ZOOMABLE =
  'width=device-width, initial-scale=1, maximum-scale=10';

// The reader page isn't zoomable (pinching would fight the paginator), so
// zoom is only allowed while an image is shown.
export const createImageViewer = (host: Document) => {
  const overlay = host.createElement('div');
  overlay.id = 'ln-image';
  overlay.hidden = true;
  const image = host.createElement('img');
  image.alt = '';
  overlay.append(image);
  host.body.append(overlay);

  const setViewport = (content: string) =>
    host
      .querySelector('meta[name="viewport"]')
      ?.setAttribute('content', content);

  const close = () => {
    overlay.hidden = true;
    image.removeAttribute('src');
    setViewport(VIEWPORT_LOCKED);
  };
  overlay.addEventListener('click', event => {
    if (event.target !== image) {
      close();
    }
  });

  return {
    open: (src: string) => {
      if (!src) {
        return;
      }
      image.src = src;
      overlay.hidden = false;
      setViewport(VIEWPORT_ZOOMABLE);
    },
  };
};
