const { div, p, img, button } = van.tags;

const ChapterEnding = () => {
  return () =>
    reader.generalSettings.val.pageReader
      ? div()
      : div(div({ class: 'info-text' }, reader.strings.finished), () =>
          reader.nextChapter
            ? button(
                {
                  class: 'next-button',
                  onclick: e => {
                    e.stopPropagation();
                    reader.post({ type: 'next' });
                  },
                },
                reader.strings.nextChapter,
              )
            : div({ class: 'info-text' }, reader.strings.noNextChapter),
        );
};

const Scrollbar = () => {
  const horizontal = van.derive(
    () => !reader.generalSettings.val.verticalSeekbar,
  );
  let lock = false;
  const percentage = van.state(0);
  const update = ratio => {
    if (ratio === undefined) {
      ratio = (window.scrollY + reader.layoutHeight) / reader.chapterHeight;
    }
    if (ratio > 1) {
      ratio = 1;
    }
    if (reader.generalSettings.val.pageReader) {
      pageReader.movePage(
        parseInt(pageReader.totalPages.val * Math.min(0.99, ratio)),
      );
      return;
    }
    percentage.val = parseInt(ratio * 100);
    if (lock) {
      window.scrollTo({
        top: reader.chapterHeight * ratio - reader.layoutHeight,
        behavior: 'instant',
      });
    }
  };
  window.addEventListener(
    'scroll',
    () => !lock && !reader.generalSettings.val.pageReader && update(),
  );
  return div(
    { id: 'ScrollBar' },
    div(
      { class: 'scrollbar-item scrollbar-text', id: 'scrollbar-percentage' },
      () =>
        reader.generalSettings.val.pageReader
          ? pageReader.page.val + 1
          : percentage.val,
    ),
    div(
      { class: 'scrollbar-item', id: 'scrollbar-slider' },
      div(
        { id: 'scrollbar-track' },
        div(
          {
            id: 'scrollbar-progress',
            style: () => {
              const percentageValue = reader.generalSettings.val.pageReader
                ? ((pageReader.page.val + 1) / pageReader.totalPages.val) * 100
                : percentage.val;
              return horizontal.val
                ? `width: ${percentageValue}%; height: 100%;`
                : `height: ${percentageValue}%; width: 100%;`;
            },
          },
          div(
            {
              id: 'scrollbar-thumb-wrapper',
              ontouchstart: () => {
                lock = true;
              },
              ontouchend: () => {
                lock = false;
              },
              ontouchmove: function (e) {
                const slider = this.parentElement.parentElement.parentElement;
                const sliderHeight = horizontal.val
                  ? slider.clientWidth
                  : slider.clientHeight;
                const sliderOffsetY = horizontal.val
                  ? slider.getBoundingClientRect().left
                  : slider.getBoundingClientRect().top;
                const ratio =
                  ((horizontal.val
                    ? e.changedTouches[0].clientX
                    : e.changedTouches[0].clientY) -
                    sliderOffsetY) /
                  sliderHeight;
                update(ratio < 0 ? 0 : ratio);
              },
            },
            div({ id: 'scrollbar-thumb' }),
          ),
        ),
      ),
    ),
    div(
      {
        class: 'scrollbar-item scrollbar-text',
        id: 'scrollbar-percentage-max',
      },
      () =>
        reader.generalSettings.val.pageReader ? pageReader.totalPages.val : 100,
    ),
  );
};

const ToolWrapper = () => {
  const horizontal = van.derive(
    () => !reader.generalSettings.val.verticalSeekbar,
  );
  return div(
    {
      id: 'ToolWrapper',
      class: () =>
        `${reader.hidden.val ? 'hidden' : ''} ${
          horizontal.val ? 'horizontal' : ''
        }`,
    },
    Scrollbar(),
  );
};

const ImageModal = ({ src }) => {
  return div(
    {
      id: 'Image-Modal',
      class: () => (src.val ? 'show' : ''),
      onclick: e => {
        if (e.target.id !== 'Image-Modal-img') {
          e.stopPropagation();
          src.val = '';
        }
      },
    },
    img({
      id: 'Image-Modal-img',
      src: src,
      alt: () => (src.val ? `Cant not render image from ${src.val}` : ''),
    }),
  );
};

const ModalWrapper = () => {
  const imgSrc = van.state('');
  const showImage = src => {
    imgSrc.val = src;
    reader.viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=10',
    );
  };
  const hideImage = () => {
    imgSrc.val = '';
    reader.viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0',
    );
  };

  document.addEventListener('contextmenu', e => {
    if (e.target instanceof HTMLImageElement) {
      if (!imgSrc.val) {
        showImage(e.target.src);
      } else {
        hideImage();
      }
    }
  });
  return div(ImageModal({ src: imgSrc }));
};

const Footer = () => {
  const percentage = van.state(0);
  const time = van.state(
    new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  );
  window.addEventListener('scroll', () => {
    let ratio = (window.scrollY + reader.layoutHeight) / reader.chapterHeight;
    if (ratio > 1) {
      ratio = 1;
    }
    percentage.val = parseInt(ratio * 100);
  });
  setInterval(() => {
    time.val = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }, 10000);
  return div(
    {
      id: 'reader-footer-wrapper',
      class: () =>
        reader.generalSettings.val.showBatteryAndTime ||
        reader.generalSettings.val.showScrollPercentage
          ? ''
          : 'd-none',
    },
    div(
      { id: 'reader-footer' },

      div(
        {
          id: 'reader-battery',
          class: () =>
            `reader-footer-item ${
              reader.generalSettings.val.showBatteryAndTime ? '' : 'hidden'
            }`,
        },
        () => Math.ceil(reader.batteryLevel.val * 100) + '%',
      ),
      div(
        {
          id: 'reader-percentage',
          class: () =>
            `reader-footer-item ${
              reader.generalSettings.val.showScrollPercentage ? '' : 'hidden'
            }`,
        },
        () =>
          reader.generalSettings.val.pageReader
            ? `${pageReader.page.val + 1}/${pageReader.totalPages.val}`
            : percentage.val + '%',
      ),
      div(
        {
          id: 'reader-time',
          class: () =>
            `reader-footer-item ${
              reader.generalSettings.val.showBatteryAndTime ? '' : 'hidden'
            }`,
        },
        time,
      ),
    ),
  );
};

const TTSController = () => {
  let controllerElement = null;
  let hoverElement = null;
  let clientX = null;
  let clientY = null;
  return div(
    {
      id: 'TTS-Controller',
      class: () => `${reader.generalSettings.val.TTSEnable ? '' : 'hidden'}`,
      style: () => reader.generalSettings.val.TTSEnable 
        ? 'pointer-events: auto;' 
        : 'pointer-events: none; display: none !important; opacity: 0; transition: none;',
      ontouchstart: () => {
        if (!controllerElement) {
          controllerElement = document.getElementById('TTS-Controller');
        }
        controllerElement.classList.add('active');
        controllerElement.style.transition = '';
      },
      ontouchmove: e => {
        e.preventDefault();
        e.stopPropagation();
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
        controllerElement.style.left = `${clientX}px`;
        controllerElement.style.top = `${clientY}px`;
        const hoverElements = document.elementsFromPoint(clientX, clientY);
        const newHoverElement = hoverElements.reverse().find(e => {
          if (e.id.includes('scrollbar')) {
            return false;
          }
          return tts.readable(e);
        });
        hoverElement?.classList.remove('highlight');
        if (newHoverElement) {
          newHoverElement.classList.add('highlight');
          hoverElement = newHoverElement;
        } else {
          hoverElement = null;
        }
      },
      ontouchend: () => {
        controllerElement.style.transition = '1s';
        controllerElement.classList.remove('active');
        controllerElement.style.left = '20px';
        if (clientX && clientY) {
          let top = clientY < 120 ? 120 : clientY;
          if (top + 120 > reader.layoutHeight) {
            top = reader.layoutHeight - 120;
          }
          controllerElement.style.top = `${top}px`;
          // Check if TTS is still enabled before starting
          if (hoverElement && reader.generalSettings.val.TTSEnable) {
            tts.start(hoverElement);
            controllerElement.firstElementChild.innerHTML = pauseIcon;
          }
        }
        clientX = null;
        clientY = null;
      },
      onclick: e => {
        e.stopPropagation();
        // Don't allow interaction if TTS is disabled
        if (!reader.generalSettings.val.TTSEnable) {
          return;
        }
        if (tts.reading) {
          tts.pause();
          controllerElement.firstElementChild.innerHTML = resumeIcon;
        } else {
          tts.resume();
          controllerElement.firstElementChild.innerHTML = pauseIcon;
        }
      },
    },
    button({ innerHTML: volumnIcon }),
  );
};

const ReaderUI = () => {
  return div(
    ToolWrapper(),
    TTSController(),
    ModalWrapper(),
    Footer(),
    ChapterEnding(),
  );
};

van.add(document.getElementById('reader-ui'), ReaderUI());
