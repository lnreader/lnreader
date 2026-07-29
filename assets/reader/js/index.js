const { div, p, img, button, span } = van.tags;

/**
 * Registers a callback for the scrolled-through ratio, coalesced to one call
 * per frame. Every scroll-driven indicator shares this: separate `scroll`
 * listeners all re-run the same work on the same frames, and that shows up
 * directly as scrolling smoothness.
 */
const onScrollRatio = (() => {
  const callbacks = [];
  let queued = false;

  window.addEventListener(
    'scroll',
    () => {
      if (queued) {
        return;
      }
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        // Progress is always reported against the chapter being read, which in
        // continuous reading is only a part of the document.
        const ratio = reader.continuousReading
          ? continuousReader.activeRatio()
          : Math.min(
              1,
              (window.scrollY + reader.layoutHeight) / reader.chapterHeight,
            );
        for (const callback of callbacks) {
          callback(ratio);
        }
      });
    },
    { passive: true },
  );

  return callback => callbacks.push(callback);
})();

const ChapterEnding = () => {
  // Nothing ends in continuous reading: the next chapter arrives by scrolling,
  // and the only thing worth saying is when there is no more of it.
  if (reader.continuousReading) {
    return div(
      {
        class: () =>
          `info-text ${continuousReader.statusText.val ? '' : 'd-none'}`,
      },
      () => continuousReader.statusText.val,
    );
  }
  return () =>
    reader.generalSettings.val.pageReader
      ? div()
      : div(div({ class: 'info-text' }, reader.strings.finished), () =>
          // Reading `adjacentVersion` subscribes this binding to the adjacent
          // chapters being pushed in after the chapter itself was rendered.
          reader.adjacentVersion.val >= 0 && reader.nextChapter
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
      ratio = reader.continuousReading
        ? continuousReader.activeRatio()
        : (window.scrollY + reader.layoutHeight) / reader.chapterHeight;
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
      if (reader.continuousReading) {
        continuousReader.scrollToRatio(ratio);
        return;
      }
      window.scrollTo({
        top: reader.chapterHeight * ratio - reader.layoutHeight,
        behavior: 'instant',
      });
    }
  };
  onScrollRatio(
    ratio => !lock && !reader.generalSettings.val.pageReader && update(ratio),
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
  onScrollRatio(ratio => {
    percentage.val = parseInt(ratio * 100);
  });
  setInterval(() => {
    if (!reader.generalSettings.val.showBatteryAndTime) {
      return;
    }
    time.val = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }, 10000);
  const wrapper = div(
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
  const footerObserver = new ResizeObserver(() => {
    document.documentElement.style.setProperty(
      '--pageReader-footerHeight',
      `${wrapper.offsetHeight}px`,
    );
  });
  footerObserver.observe(wrapper);
  requestAnimationFrame(() => {
    document.documentElement.style.setProperty(
      '--pageReader-footerHeight',
      `${wrapper.offsetHeight}px`,
    );
  });
  return wrapper;
};

const TTSController = () => {
  let controllerElement = null;
  let hoverElement = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let moved = false;
  const collapsed = van.state(true);
  let collapseButtonElement = null;
  let lastBubbleTouchEnd = 0;

  const stopEvent = e => {
    e.preventDefault();
    e.stopPropagation();
  };

  const setControllerPosition = touch => {
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

    controllerElement.style.left = `${left}px`;
    controllerElement.style.top = `${top}px`;
    controllerElement.style.right = 'auto';
    controllerElement.style.bottom = 'auto';
  };

  const clampControllerToViewport = () => {
    const bounds = controllerElement.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - bounds.width - 8);
    const maxTop = Math.max(8, window.innerHeight - bounds.height - 8);

    controllerElement.style.left = `${Math.min(
      maxLeft,
      Math.max(8, bounds.left),
    )}px`;
    controllerElement.style.top = `${Math.min(
      maxTop,
      Math.max(8, bounds.top),
    )}px`;
    controllerElement.style.right = 'auto';
    controllerElement.style.bottom = 'auto';
  };

  const setCollapsed = value => {
    collapsed.val = value;
    controllerElement ??= document.getElementById('TTS-Controller');
    collapseButtonElement ??= controllerElement.querySelector(
      '.tts-collapse-toggle',
    );
    collapseButtonElement.setAttribute(
      'aria-label',
      collapsed.val
        ? 'Expand text-to-speech controls'
        : 'Minimize text-to-speech controls',
    );
    collapseButtonElement.innerHTML = collapsed.val
      ? textToSpeechIcon
      : minimizeIcon;
    requestAnimationFrame(clampControllerToViewport);
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

    moved = true;
    setControllerPosition(touch);

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

  const startBubbleDrag = e => {
    if (!collapsed.val) {
      return;
    }
    stopEvent(e);
    controllerElement ??= document.getElementById('TTS-Controller');
    const touch = e.changedTouches[0];
    const bounds = controllerElement.getBoundingClientRect();
    dragOffsetX = touch.clientX - bounds.left;
    dragOffsetY = touch.clientY - bounds.top;
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    moved = false;
    controllerElement.classList.add('active');
    controllerElement.style.transition = 'none';
  };

  const moveBubbleDrag = e => {
    if (!collapsed.val) {
      return;
    }
    stopEvent(e);
    const touch = e.changedTouches[0];
    if (
      !moved &&
      Math.hypot(touch.clientX - dragStartX, touch.clientY - dragStartY) < 6
    ) {
      return;
    }
    moved = true;
    setControllerPosition(touch);
  };

  const finishBubbleDrag = () => {
    controllerElement.classList.remove('active');
    controllerElement.style.transition = '';
    moved = false;
  };

  const endBubbleDrag = e => {
    if (!collapsed.val) {
      return;
    }
    stopEvent(e);
    const shouldExpand = !moved;
    lastBubbleTouchEnd = Date.now();
    finishBubbleDrag();
    if (shouldExpand) {
      setCollapsed(false);
    }
  };

  const cancelBubbleDrag = e => {
    if (!collapsed.val) {
      return;
    }
    stopEvent(e);
    lastBubbleTouchEnd = Date.now();
    finishBubbleDrag();
  };

  const toggleCollapsed = e => {
    e.stopPropagation();
    if (Date.now() - lastBubbleTouchEnd < 500) {
      return;
    }
    setCollapsed(!collapsed.val);
  };

  const runCommand = command => e => {
    e.stopPropagation();
    if (reader.generalSettings.val.TTSEnable) {
      command();
    }
  };

  collapseButtonElement = button({
    type: 'button',
    class: 'tts-collapse-toggle',
    'aria-label': 'Expand text-to-speech controls',
    innerHTML: textToSpeechIcon,
    ontouchstart: startBubbleDrag,
    ontouchmove: moveBubbleDrag,
    ontouchend: endBubbleDrag,
    ontouchcancel: cancelBubbleDrag,
    onclick: toggleCollapsed,
  });

  return div(
    {
      id: 'TTS-Controller',
      class: () =>
        [
          reader.generalSettings.val.TTSEnable ? '' : 'hidden',
          collapsed.val ? 'collapsed' : '',
        ]
          .filter(Boolean)
          .join(' '),
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
    collapseButtonElement,
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
