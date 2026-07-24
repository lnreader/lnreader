const { div, p, img, button, span } = van.tags;

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
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let moved = false;

  const stopEvent = e => {
    e.preventDefault();
    e.stopPropagation();
  };

  const startDrag = e => {
    stopEvent(e);
    controllerElement ??= document.getElementById('TTS-Controller');
    const touch = e.changedTouches[0];
    const bounds = controllerElement.getBoundingClientRect();
    dragOffsetX = touch.clientX - bounds.left;
    dragOffsetY = touch.clientY - bounds.top;
    moved = false;
    controllerElement.classList.add('active');
    controllerElement.style.transition = 'none';
  };

  const moveDrag = e => {
    stopEvent(e);
    const touch = e.changedTouches[0];
    const maxLeft = Math.max(
      8,
      window.innerWidth - controllerElement.offsetWidth - 8,
    );
    const maxTop = Math.max(
      8,
      window.innerHeight - controllerElement.offsetHeight - 8,
    );
    const left = Math.min(maxLeft, Math.max(8, touch.clientX - dragOffsetX));
    const top = Math.min(maxTop, Math.max(8, touch.clientY - dragOffsetY));

    moved = true;
    controllerElement.style.left = `${left}px`;
    controllerElement.style.top = `${top}px`;
    controllerElement.style.right = 'auto';
    controllerElement.style.bottom = 'auto';

    const newHoverElement = document
      .elementsFromPoint(touch.clientX, touch.clientY)
      .find(
        element =>
          !element.closest('#TTS-Controller') &&
          !element.id.includes('scrollbar') &&
          tts.readable(element),
      );
    hoverElement?.classList.remove('highlight');
    hoverElement = newHoverElement ?? null;
    hoverElement?.classList.add('highlight');
  };

  const endDrag = e => {
    stopEvent(e);
    controllerElement.classList.remove('active');
    controllerElement.style.transition = '';

    if (moved && hoverElement && reader.generalSettings.val.TTSEnable) {
      tts.start(hoverElement);
    }
    hoverElement?.classList.remove('highlight');
    hoverElement = null;
    moved = false;
  };

  const runCommand = command => e => {
    e.stopPropagation();
    if (reader.generalSettings.val.TTSEnable) {
      command();
    }
  };

  return div(
    {
      id: 'TTS-Controller',
      class: () => `${reader.generalSettings.val.TTSEnable ? '' : 'hidden'}`,
      style: () =>
        reader.generalSettings.val.TTSEnable
          ? 'pointer-events: auto;'
          : 'pointer-events: none; display: none !important; opacity: 0; transition: none;',
      onclick: e => e.stopPropagation(),
    },
    button({
      type: 'button',
      class: 'tts-drag-handle',
      'aria-label': 'Move text-to-speech controls',
      innerHTML: dragHandleIcon,
      ontouchstart: startDrag,
      ontouchmove: moveDrag,
      ontouchend: endDrag,
      ontouchcancel: endDrag,
      onclick: stopEvent,
    }),
    button({
      type: 'button',
      class: 'tts-control-button',
      'aria-label': 'Previous paragraph',
      innerHTML: previousParagraphIcon,
      onclick: runCommand(() => tts.previous()),
    }),
    button({
      id: 'TTS-PlayPause',
      type: 'button',
      class: 'tts-control-button tts-play-pause',
      'aria-label': 'Play text-to-speech',
      innerHTML: resumeIcon,
      onclick: runCommand(() => {
        if (tts.reading) {
          tts.pause();
        } else if (tts.started) {
          tts.resume();
        } else {
          tts.start();
        }
      }),
    }),
    button({
      type: 'button',
      class: 'tts-control-button',
      'aria-label': 'Next paragraph',
      innerHTML: nextParagraphIcon,
      onclick: runCommand(() => tts.next()),
    }),
    span({ id: 'TTS-Progress', 'aria-hidden': 'true' }),
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
