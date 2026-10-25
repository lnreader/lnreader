window.onUserInteraction = (() => {
  let groupStart = 0;
  // Group multiple interactions within a short time frame to avoid excessive calls
  const groupTime = 3000;
  return () => {
    let now = Date.now();
    if (now - groupStart < groupTime) {
      // We're inside the group
    } else {
      // We're the first in a while
      groupStart = now;
      reader.post({ type: 'interaction' });
    }
  };
})();

/* eslint-disable no-console */
window.reader = new (function () {
  const {
    readerSettings,
    chapterGeneralSettings,
    novel,
    chapter,
    batteryLevel,
    autoSaveInterval,
    DEBUG,
    strings,
  } = initialReaderConfig;

  // state
  this.hidden = van.state(true);
  this.batteryLevel = van.state(batteryLevel);
  this.readerSettings = van.state(readerSettings);
  this.generalSettings = van.state(chapterGeneralSettings);
  /**
   * Bumped whenever the app pushes new adjacent chapters. The chapter is
   * rendered before its neighbours are known, so any UI that depends on them
   * has to read this state to re-render when they arrive.
   */
  this.adjacentVersion = van.state(0);

  this.chapterElement = document.querySelector('#LNReader-chapter');
  this.selection = window.getSelection();
  this.viewport = document.querySelector('meta[name=viewport]');

  this.novel = novel;
  this.chapter = chapter;
  this.nextChapter = undefined;
  this.prevChapter = undefined;
  this.strings = strings;

  /** Called by the app once the neighbouring chapters have been resolved. */
  this.setAdjacentChapters = ({ nextChapter, prevChapter, strings: texts }) => {
    this.nextChapter = nextChapter ?? undefined;
    this.prevChapter = prevChapter ?? undefined;
    Object.assign(this.strings, texts);
    this.adjacentVersion.val++;
  };
  this.autoSaveInterval = autoSaveInterval;

  /**
   * The chapters in the document, in reading order. Only infinite scrolling
   * ever appends to it; `chapter` and `chapterElement` always point at the
   * one being read.
   */
  this.segments = [
    {
      chapter,
      element: this.chapterElement,
      rawHTML: this.chapterElement.innerHTML,
    },
  ];
  /**
   * The segment of the document's own `#LNReader-chapter` element. Infinite
   * scrolling can drop it from `segments`, but paged mode always lays out the
   * current chapter in it.
   */
  this.hostSegment = this.segments[0];
  Object.defineProperty(this, 'rawHTML', {
    get: () => this.segments[0].rawHTML,
    set: value => {
      this.segments[0].rawHTML = value;
    },
  });

  //layout props
  this.paddingTop = parseInt(
    getComputedStyle(document.querySelector('body')).getPropertyValue(
      'padding-top',
    ),
    10,
  );
  /** Document offset the current chapter starts at, in scroll mode. */
  this.chapterTop = 0;
  this.chapterHeight = this.chapterElement.scrollHeight + this.paddingTop;
  this.layoutHeight = window.innerHeight;
  this.layoutWidth = window.innerWidth;

  this.layoutEvent = undefined;
  this.chapterEndingVisible = van.state(false);

  this.post = obj => window.ReactNativeWebView.postMessage(JSON.stringify(obj));

  /** Document offset each chapter ends at, in scroll mode. */
  this.chapterEnds = () =>
    this.segments.map(segment =>
      segment === this.hostSegment
        ? this.paddingTop + segment.element.scrollHeight
        : segment.element.getBoundingClientRect().bottom + window.scrollY,
    );

  this.measureChapter = (ends = this.chapterEnds()) => {
    const index = Math.max(
      0,
      this.segments.findIndex(
        segment => segment.element === this.chapterElement,
      ),
    );
    this.chapterTop = index > 0 ? ends[index - 1] : 0;
    this.chapterHeight = ends[index] - this.chapterTop;
  };

  this.refresh = () => {
    this.layoutHeight = window.innerHeight;
    this.layoutWidth = window.innerWidth;
    this.paddingTop =
      parseFloat(
        getComputedStyle(document.body).getPropertyValue('padding-top'),
      ) || 0;
    if (this.generalSettings.val.pageReader) {
      this.chapterWidth = this.chapterElement.scrollWidth;
    } else {
      this.measureChapter();
    }
  };

  let loadedFontFamily = readerSettings.fontFamily || '';
  van.derive(() => {
    const settings = this.readerSettings.val;
    document.documentElement.style.setProperty(
      '--readerSettings-theme',
      settings.theme,
    );
    document.documentElement.style.setProperty(
      '--readerSettings-padding',
      settings.padding + 'px',
    );
    document.documentElement.style.setProperty(
      '--readerSettings-textSize',
      settings.textSize + 'px',
    );
    document.documentElement.style.setProperty(
      '--readerSettings-textColor',
      settings.textColor,
    );
    document.documentElement.style.setProperty(
      '--readerSettings-textAlign',
      settings.textAlign,
    );
    document.documentElement.style.setProperty(
      '--readerSettings-lineHeight',
      settings.lineHeight,
    );
    document.documentElement.style.setProperty(
      '--readerSettings-fontFamily',
      settings.fontFamily,
    );
    if (settings.fontFamily && settings.fontFamily !== loadedFontFamily) {
      loadedFontFamily = settings.fontFamily;
      new FontFace(
        settings.fontFamily,
        'url("file:///android_asset/fonts/' + settings.fontFamily + '.ttf")',
      )
        .load()
        .then(function (loadedFont) {
          document.fonts.add(loadedFont);
          schedulePageCalculation();
        });
    } else if (!settings.fontFamily && loadedFontFamily) {
      loadedFontFamily = '';
      // have no affect with a font declared in head
      document.fonts.forEach(fontFace => document.fonts.delete(fontFace));
    }
    schedulePageCalculation();
  });

  document.onscrollend = () => {
    onUserInteraction();
    if (!this.generalSettings.val.pageReader) {
      window.continuousScroll.update();
      window.continuousScroll.trim();
      this.post({
        type: 'save',
        chapterId: this.chapter.id,
        data: parseInt(
          ((window.scrollY + this.layoutHeight - this.chapterTop) /
            this.chapterHeight) *
            100,
          10,
        ),
      });
    }
  };

  document.onpointerdown = () => onUserInteraction();
  document.onpointermove = () => onUserInteraction();
  document.onpointerup = () => onUserInteraction();

  if (DEBUG) {
    // eslint-disable-next-line no-global-assign, no-new-object
    console = new Object();
    console.log = function (...data) {
      reader.post({ 'type': 'console', 'msg': data?.join(' ') });
    };
    console.debug = console.log;
    console.info = console.log;
    console.warn = console.log;
    console.error = console.log;
  }
  // end reader
})();

window.tts = new (function () {
  this.readableNodeNames = [
    '#text',
    'B',
    'I',
    'SPAN',
    'EM',
    'BR',
    'STRONG',
    'A',
    'MARK',
  ];
  this.prevElement = null;
  this.currentElement = reader.chapterElement;
  this.started = false;
  this.reading = false;
  this.elementsRead = 0;
  this.totalElements = 0;
  this.allReadableElements = []; // Store all readable elements at start
  this.textQueue = []; // Flat list of normalized text for native fallback

  this.readable = element => {
    const ele = element ?? this.currentElement;
    if (
      ele.nodeName !== 'SPAN' &&
      this.readableNodeNames.includes(ele.nodeName)
    ) {
      return false;
    }
    if (!ele.hasChildNodes()) {
      return false;
    }
    for (let i = 0; i < ele.childNodes.length; i++) {
      if (!this.readableNodeNames.includes(ele.childNodes.item(i).nodeName)) {
        return false;
      }
    }
    return true;
  };

  this.normalizeText = text => {
    if (!text) return '';
    const normalized = text
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
      .replace(/\s*([.,!?;:])\s*/g, '$1 ')
      .trim();

    const dashOnlyText = normalized.replace(/\s/g, '');
    if (
      dashOnlyText.length >= 3 &&
      /^[\-‐‑‒–—―−⁓⸺⸻﹘﹣－]+$/u.test(dashOnlyText)
    ) {
      return '';
    }

    return normalized;
  };

  // if can find a readable node, else stop tts
  // FIXED: Added proper boundary checks to prevent stack overflow
  this.findNextTextNode = (depth = 0) => {
    // Prevent deep recursion
    if (depth > 500) {
      console.warn('TTS: findNextTextNode max depth reached');
      return false;
    }

    if (this.currentElement.isSameNode(reader.chapterElement) && this.started) {
      return false;
    } else {
      this.started = true;
    }

    // Safety check: ensure currentElement is valid
    if (!this.currentElement || !this.currentElement.nodeName) {
      return false;
    }

    // is read, have to go next or go back
    if (this.currentElement.isSameNode(this.prevElement)) {
      this.prevElement = this.currentElement;
      if (this.currentElement.nextElementSibling) {
        this.currentElement = this.currentElement.nextElementSibling;
        return this.findNextTextNode(depth + 1);
      } else if (
        this.currentElement.parentElement &&
        !this.currentElement.parentElement.isSameNode(document.body) &&
        !this.currentElement.parentElement.isSameNode(document.documentElement)
      ) {
        this.currentElement = this.currentElement.parentElement;
        return this.findNextTextNode(depth + 1);
      } else {
        return false;
      }
    } else {
      // can read? read it
      if (this.readable()) {
        return true;
      }
      if (
        !this.prevElement?.parentElement?.isSameNode(this.currentElement) &&
        this.currentElement.firstElementChild
      ) {
        // go deep
        this.prevElement = this.currentElement;
        this.currentElement = this.currentElement.firstElementChild;
        return this.findNextTextNode(depth + 1);
      } else if (this.currentElement.nextElementSibling) {
        this.prevElement = this.currentElement;
        this.currentElement = this.currentElement.nextElementSibling;
        return this.findNextTextNode(depth + 1);
      } else if (
        this.currentElement.parentElement &&
        !this.currentElement.parentElement.isSameNode(document.body) &&
        !this.currentElement.parentElement.isSameNode(document.documentElement)
      ) {
        this.prevElement = this.currentElement;
        this.currentElement = this.currentElement.parentElement;
        return this.findNextTextNode(depth + 1);
      } else {
        return false;
      }
    }
  };

  this.next = () => {
    if (!this.started) return;
    reader.post({ type: 'tts-command', data: { command: 'next' } });
  };

  this.previous = () => {
    if (!this.started) return;
    reader.post({ type: 'tts-command', data: { command: 'previous' } });
  };

  this.start = element => {
    const startElement = element ?? reader.chapterElement;

    const readableEntries = this.getAllReadableElements(reader.chapterElement)
      .map(readableElement => ({
        element: readableElement,
        text: this.normalizeText(readableElement.innerText),
      }))
      .filter(entry => !!entry.text);
    this.allReadableElements = readableEntries.map(entry => entry.element);
    this.totalElements = this.allReadableElements.length;
    this.textQueue = readableEntries.map(entry => entry.text);

    const requestedIndex =
      element && element !== reader.chapterElement
        ? this.allReadableElements.indexOf(startElement)
        : 0;
    const startIndex = requestedIndex >= 0 ? requestedIndex : 0;

    this.started = this.totalElements > 0;
    this.reading = this.started;
    this.setActiveIndex(startIndex);
    reader.post({
      type: 'tts-queue',
      data: {
        queue: this.textQueue,
        startIndex,
      },
    });
  };

  // Get all readable elements in order
  this.getAllReadableElements = element => {
    const elements = [];
    const traverse = el => {
      if (!el) return;
      if (this.readable(el)) {
        elements.push(el);
        // innerText already includes readable descendants, so descending any
        // further would add overlapping text to the speech queue.
        return;
      }
      for (let i = 0; i < el.children.length; i++) {
        traverse(el.children[i]);
      }
    };
    traverse(element);
    return elements;
  };

  this.resume = () => {
    if (!this.started) return;
    reader.post({ type: 'tts-command', data: { command: 'play' } });
  };

  this.pause = () => {
    if (!this.started) return;
    reader.post({ type: 'tts-command', data: { command: 'pause' } });
  };

  this.rewind = () => {
    if (!this.started) return;
    reader.post({ type: 'tts-command', data: { command: 'replay' } });
  };

  this.seekTo = index => {
    if (!this.started || !this.allReadableElements.length) return;
    const targetIndex = Math.max(0, Math.min(index, this.totalElements - 1));
    reader.post({
      type: 'tts-command',
      data: { command: 'seekTo', index: targetIndex },
    });
  };

  this.stop = () => {
    reader.post({ type: 'tts-command', data: { command: 'stop' } });
    this.reset();
  };

  this.reset = () => {
    this.currentElement?.classList?.remove('highlight');
    this.prevElement = null;
    this.currentElement = reader.chapterElement;
    this.started = false;
    this.reading = false;
    this.elementsRead = 0;
    this.totalElements = 0;
    this.allReadableElements = [];
    this.textQueue = [];
    const playPauseButton = document.getElementById('TTS-PlayPause');
    if (playPauseButton) playPauseButton.innerHTML = resumeIcon;
    const progress = document.getElementById('TTS-Progress');
    if (progress) progress.textContent = '';
  };

  this.setActiveIndex = index => {
    if (!this.allReadableElements.length) return;
    const targetIndex = Math.max(0, Math.min(index, this.totalElements - 1));
    this.currentElement?.classList?.remove('highlight');
    this.currentElement = this.allReadableElements[targetIndex];
    this.elementsRead = targetIndex + 1;
    this.started = true;
    this.scrollToElement(this.currentElement);
    this.currentElement.classList.add('highlight');
    const progress = document.getElementById('TTS-Progress');
    if (progress) {
      progress.textContent = `${targetIndex + 1}/${this.totalElements}`;
    }
  };

  this.setPlaybackState = state => {
    this.reading = state === 'playing';
    if (state === 'error') {
      this.reset();
      return;
    }
    const playPauseButton = document.getElementById('TTS-PlayPause');
    if (playPauseButton) {
      playPauseButton.innerHTML = this.reading ? pauseIcon : resumeIcon;
    }
  };

  this.complete = () => {
    this.reading = false;
    if (
      reader.readerSettings.val.tts?.autoPageAdvance === true &&
      reader.nextChapter
    ) {
      reader.post({ type: 'next', autoStartTTS: true });
      return;
    }
    this.reset();
  };

  this.isElementInViewport = element => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const windowWidth =
      window.innerWidth || document.documentElement.clientWidth;

    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= windowHeight &&
      rect.right <= windowWidth
    );
  };

  // UPDATED: Scroll to top or center based on settings with padding for notch/camera
  this.scrollToElement = element => {
    if (!element) return;
    // Check if element is partially visible (at least some part is in viewport)
    const rect = element.getBoundingClientRect();
    if (reader.generalSettings.val.pageReader) {
      const relativePage = Math.floor(
        (rect.left + rect.width / 2) / reader.layoutWidth,
      );
      pageReader.movePage(
        Math.max(
          0,
          Math.min(
            pageReader.totalPages.val - 1,
            pageReader.page.val + relativePage,
          ),
        ),
      );
      return;
    }
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const isPartiallyVisible =
      rect.top < windowHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0;

    // Only scroll if element is not visible or barely visible
    if (!isPartiallyVisible || rect.top < 0 || rect.bottom > windowHeight) {
      // Check scrollToTop setting (default to true for better reading experience)
      const scrollToTop = reader.readerSettings.val.tts?.scrollToTop !== false;

      if (scrollToTop) {
        // Scroll to top with padding for notch/camera (80px from top)
        const elementTop =
          element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementTop - 80; // 80px padding for notch/camera

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
      } else {
        // Center scroll (original behavior)
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
    }
  };

  this.speak = () => {
    this.rewind();
  };
})();

// Watch for TTSEnable changes and stop TTS when disabled
van.derive(() => {
  if (!reader.generalSettings.val.TTSEnable && window.tts) {
    if (tts.reading || tts.started) {
      tts.stop();
    }
  }
});

var pageReader;
window.pageReader = pageReader = new (function () {
  const config =
    typeof initialPageReaderConfig === 'undefined'
      ? {}
      : initialPageReaderConfig;
  this.page = van.state(0);
  this.totalPages = van.state(0);
  this.ignoreClickUntil = 0;
  this.chapterNavigationPending = false;
  this.chapterEndingVisible = van.state(
    config.nextChapterScreenVisible === true,
  );
  this.chapterEnding = document.getElementsByClassName('transition-chapter')[0];

  this.showChapterEnding = (bool, instant, left) => {
    if (!this.chapterEnding) {
      this.chapterEnding =
        document.getElementsByClassName('transition-chapter')[0];
      if (!this.chapterEnding) return;
    }
    const noAnim = Boolean(
      reader.generalSettings?.val?.pageReaderDisableAnimation,
    );
    this.chapterEnding.style.transition = 'unset';
    if (bool) {
      this.chapterEnding.style.transform = `translateX(${left ? -200 : 0}vw)`;
      requestAnimationFrame(() => {
        if (!instant && !noAnim) {
          this.chapterEnding.style.transition = 'transform 200ms';
        }
        this.chapterEnding.style.transform = 'translateX(-100vw)';
      });
      this.chapterEndingVisible.val = true;
    } else {
      if (!instant && !noAnim) {
        this.chapterEnding.style.transition = 'transform 200ms';
      }
      this.chapterEnding.style.transform = `translateX(${left ? -200 : 0}vw)`;
      this.chapterEndingVisible.val = false;
    }
  };

  this.movePage = (destPage, { interaction = true, save = true } = {}) => {
    if (interaction) {
      onUserInteraction();
    }
    if (this.chapterEndingVisible.val) {
      if (this.chapterNavigationPending) {
        return;
      }
      if (destPage < 0) {
        this.showChapterEnding(false);
        return;
      }
      this.showChapterEnding(false, false, true);
      return;
    }
    destPage = parseInt(destPage, 10);
    const noAnim = Boolean(
      reader.generalSettings?.val?.pageReaderDisableAnimation,
    );
    if (destPage < 0) {
      if (!reader.prevChapter) return;
      document.getElementsByClassName('transition-chapter')[0].innerText =
        reader.prevChapter.name;
      this.showChapterEnding(true, noAnim, true);
      this.chapterNavigationPending = true;
      setTimeout(
        () => {
          reader.post({ type: 'prev' });
        },
        noAnim ? 0 : 200,
      );
      return;
    }
    if (destPage >= this.totalPages.val) {
      if (!reader.nextChapter) return;
      document.getElementsByClassName('transition-chapter')[0].innerText =
        reader.nextChapter.name;
      this.showChapterEnding(true, noAnim);
      this.chapterNavigationPending = true;
      setTimeout(
        () => {
          reader.post({ type: 'next' });
        },
        noAnim ? 0 : 200,
      );
      return;
    }
    this.page.val = destPage;
    reader.chapterElement.style.transform =
      'translateX(-' + destPage * 100 + '%)';

    const newProgress = parseInt(
      ((this.page.val + 1) / this.totalPages.val) * 100,
      10,
    );

    if (save && newProgress > reader.chapter.progress) {
      reader.chapter.progress = newProgress;
      reader.post({
        type: 'save',
        chapterId: reader.chapter.id,
        data: newProgress,
      });
    }
  };

  this.repaginate = ratio => {
    const previousTotal = this.totalPages.val;
    const currentRatio =
      previousTotal > 0 ? (this.page.val + 1) / previousTotal : 0;
    const positionRatio = Number.isFinite(ratio)
      ? ratio
      : currentRatio || reader.chapter.progress / 100;

    reader.refresh();
    const chapterStyle = getComputedStyle(reader.chapterElement);
    const horizontalPadding =
      (parseFloat(chapterStyle.paddingLeft) || 0) +
      (parseFloat(chapterStyle.paddingRight) || 0);
    this.totalPages.val = Math.max(
      1,
      Math.floor(
        (reader.chapterWidth + horizontalPadding) /
          (reader.chapterElement.clientWidth || reader.layoutWidth) +
          0.001,
      ),
    );

    if (this.chapterEndingVisible.val) {
      return;
    }

    const destination = Math.min(
      this.totalPages.val - 1,
      Math.max(
        0,
        Math.round(
          this.totalPages.val * Math.min(1, Math.max(0, positionRatio)),
        ) - 1,
      ),
    );
    this.movePage(destination, { interaction: false, save: false });
  };

  van.derive(() => {
    // ignore if initial or other states change
    if (
      reader.generalSettings.val.pageReader ===
      reader.generalSettings.oldVal.pageReader
    ) {
      return;
    }
    if (reader.generalSettings.val.pageReader) {
      const ratio = Math.min(
        0.99,
        (window.scrollY + reader.layoutHeight - reader.chapterTop) /
          reader.chapterHeight,
      );
      window.continuousScroll.collapse();
      document.body.classList.add('page-reader');
      requestAnimationFrame(() => this.repaginate(ratio));
    } else {
      const ratio =
        this.totalPages.val > 0 ? (this.page.val + 1) / this.totalPages.val : 0;
      reader.chapterElement.style.removeProperty('transform');
      reader.chapterElement.style.removeProperty('transition');
      document.body.classList.remove('page-reader');
      requestAnimationFrame(() => {
        reader.refresh();
        window.scrollTo({
          top: reader.chapterHeight * ratio - reader.layoutHeight,
          behavior: 'smooth',
        });
      });
    }
  });

  van.derive(() => {
    document.body.classList.toggle(
      'no-animation',
      Boolean(reader.generalSettings.val.pageReaderDisableAnimation),
    );
    reader.chapterElement?.style.removeProperty('transition');
    const chapterEnding =
      this.chapterEnding ||
      document.getElementsByClassName('transition-chapter')[0];
    chapterEnding?.style.removeProperty('transition');
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  if (pageReader.chapterEndingVisible.val) {
    pageReader.showChapterEnding(true, true);
  }
});

/**
 * Infinite scrolling. When the end of the last chapter in the document comes
 * close, the app is asked for the chapter after it, which is appended below so
 * reading carries on without leaving the page. Whichever chapter reaches the
 * top of the screen becomes the current one for progress, history and the
 * header. Only the chapter before the current one is kept above it, so a long
 * session does not keep growing the document.
 */
window.continuousScroll = new (function () {
  /** Chapters kept above the current one; older ones are dropped. */
  const KEEP_BEHIND = 1;
  /** 'idle' | 'loading' | 'error' | 'end' */
  this.status = van.state('idle');
  this.errorMessage = '';
  this.activeIndex = 0;

  const enabled = () =>
    Boolean(reader.generalSettings.val.infiniteScroll) &&
    !reader.generalSettings.val.pageReader;

  const activate = index => {
    if (index === this.activeIndex) {
      return;
    }
    // Scrolling down past the end of a chapter means it has been read; the
    // scroll that crossed it may never have reported its last screen.
    for (let i = this.activeIndex; i < index; i++) {
      reader.post({
        type: 'save',
        chapterId: reader.segments[i].chapter.id,
        data: 100,
      });
    }
    this.activeIndex = index;
    const segment = reader.segments[index];
    reader.chapter = segment.chapter;
    reader.chapterElement = segment.element;
    if (tts.started) {
      tts.reset();
    }
    window.readerSearch?.clear(false);
    reader.post({ type: 'chapter-change', chapterId: segment.chapter.id });
  };

  this.update = () => {
    if (reader.generalSettings.val.pageReader) {
      return;
    }
    const loadNext = enabled() && this.status.val === 'idle';
    if (reader.segments.length < 2 && !loadNext) {
      return;
    }
    const ends = reader.chapterEnds();
    if (reader.segments.length > 1) {
      const atBottom =
        window.scrollY + reader.layoutHeight >=
        document.documentElement.scrollHeight - 1;
      let index = reader.segments.length - 1;
      // A chapter shorter than the screen never reaches the top of it, so the
      // last one is current once the page cannot scroll any further.
      if (!atBottom) {
        while (index > 0 && ends[index - 1] > window.scrollY + 1) {
          index--;
        }
      }
      activate(index);
      reader.measureChapter(ends);
    }

    if (!loadNext) {
      return;
    }
    // Requested while about two screens are still left to read, so the next
    // chapter is usually in place before the reader gets there.
    if (window.scrollY + reader.layoutHeight * 3 < ends[ends.length - 1]) {
      return;
    }
    this.status.val = 'loading';
    reader.post({
      type: 'continuous-next',
      chapterId: reader.segments[reader.segments.length - 1].chapter.id,
    });
  };

  /**
   * Whether an answer from the app is for the request still outstanding. The
   * document can change in the meantime, for example by switching to paged
   * mode, which keeps only the current chapter.
   */
  const isAwaited = afterChapterId =>
    this.status.val === 'loading' &&
    !reader.generalSettings.val.pageReader &&
    reader.segments[reader.segments.length - 1].chapter.id === afterChapterId;

  this.append = ({ afterChapterId, chapter, html }) => {
    if (!isAwaited(afterChapterId)) {
      return;
    }
    const divider = document.createElement('div');
    divider.className = 'continuous-chapter-divider';
    divider.textContent = chapter.name;
    const element = document.createElement('div');
    element.className = 'LNReader-chapter-continued';
    element.dataset.chapterId = chapter.id;

    const segment = { chapter, element, divider, rawHTML: html };
    reader.renderChapterHTML(segment);
    const readerUI = document.getElementById('reader-ui');
    document.body.insertBefore(divider, readerUI);
    document.body.insertBefore(element, readerUI);
    try {
      window.fn?.(element);
    } catch (e) {
      console.error(e);
    }
    reader.attachChapterGestures(element);
    reader.segments.push(segment);

    this.status.val = 'idle';
    // A short chapter can leave the end close enough to need the next one.
    requestAnimationFrame(() => this.update());
  };

  this.end = afterChapterId => {
    if (isAwaited(afterChapterId)) {
      this.status.val = 'end';
    }
  };

  this.fail = (afterChapterId, message) => {
    if (isAwaited(afterChapterId)) {
      this.errorMessage = message || '';
      this.status.val = 'error';
    }
  };

  this.retry = () => {
    this.status.val = 'idle';
    this.update();
  };

  /**
   * Drops the chapters more than `KEEP_BEHIND` above the current one. Called
   * once scrolling has settled, and the scroll position is corrected so the
   * text on screen does not move.
   */
  this.trim = () => {
    const excess = this.activeIndex - KEEP_BEHIND;
    if (excess <= 0 || reader.generalSettings.val.pageReader) {
      return;
    }
    const anchor = reader.segments[this.activeIndex].element;
    const anchorTop = anchor.getBoundingClientRect().top;
    const dropped = reader.segments.splice(0, excess);
    for (const segment of dropped) {
      if (segment === reader.hostSegment) {
        segment.element.innerHTML = '';
        segment.appliedHTML = '';
        segment.element.style.display = 'none';
      } else {
        segment.divider.remove();
        segment.element.remove();
      }
    }
    this.activeIndex -= excess;
    window.scrollTo({
      top: window.scrollY + anchor.getBoundingClientRect().top - anchorTop,
      behavior: 'instant',
    });
    reader.measureChapter();
    reader.post({
      type: 'chapters-dropped',
      data: dropped.map(segment => segment.chapter.id),
    });
  };

  /** Paged mode lays out the current chapter alone, in the host element. */
  this.collapse = () => {
    // A request still outstanding is answered in paged mode and ignored, so it
    // must not block the next one once scroll mode is back.
    this.status.val = 'idle';
    const host = reader.hostSegment;
    const current = reader.segments[this.activeIndex];
    if (reader.segments.length === 1 && current === host) {
      return;
    }
    if (current !== host) {
      host.element.innerHTML = current.element.innerHTML;
      host.chapter = current.chapter;
      host.rawHTML = current.rawHTML;
      host.appliedHTML = current.appliedHTML;
    }
    host.element.style.removeProperty('display');
    document
      .querySelectorAll(
        '.continuous-chapter-divider, .LNReader-chapter-continued',
      )
      .forEach(element => element.remove());
    reader.segments = [host];
    reader.chapter = host.chapter;
    reader.chapterElement = host.element;
    this.activeIndex = 0;
    reader.refresh();
  };

  van.derive(() => {
    // Turned on at the end of a chapter there is nothing left to scroll, which
    // is otherwise what asks for the next chapter.
    if (reader.generalSettings.val.infiniteScroll) {
      requestAnimationFrame(() => this.update());
    }
  });

  // The document can be rebuilt (for example after a theme change) while a
  // later chapter is current, so tell the app which chapter this one shows.
  reader.post({ type: 'chapter-change', chapterId: reader.chapter.id });
})();

/** Scroll offset the reading position was restored to, in scroll mode. */
let restoredScrollTop = null;
let positionRestored = false;

function calculatePages(behavior = 'instant') {
  reader.refresh();

  if (reader.generalSettings.val.pageReader) {
    pageReader.repaginate(reader.chapter.progress / 100);
  } else {
    restoredScrollTop =
      reader.chapterTop +
      (reader.chapterHeight * reader.chapter.progress) / 100 -
      reader.layoutHeight;
    window.scrollTo({ top: restoredScrollTop, behavior });
  }
}

let pageCalculationFrame;
let pendingPageRatio;
function schedulePageCalculation(ratio) {
  if (Number.isFinite(ratio)) {
    pendingPageRatio = ratio;
  }
  if (
    pageCalculationFrame ||
    !window.pageReader ||
    !reader.generalSettings.val.pageReader
  ) {
    return;
  }
  pageCalculationFrame = requestAnimationFrame(() => {
    pageCalculationFrame = undefined;
    const nextRatio = pendingPageRatio;
    pendingPageRatio = undefined;
    pageReader.repaginate(nextRatio);
  });
}

const ro = new ResizeObserver(() => {
  if (pageReader.totalPages.val && reader.generalSettings.val.pageReader) {
    schedulePageCalculation();
  }
});
ro.observe(reader.chapterElement);
reader.chapterElement.addEventListener(
  'load',
  () => schedulePageCalculation(),
  true,
);

let viewportResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(viewportResizeTimer);
  viewportResizeTimer = setTimeout(() => {
    if (reader.generalSettings.val.pageReader) {
      schedulePageCalculation();
    } else {
      reader.refresh();
    }
  }, 100);
});

/**
 * Fonts and images can still change the chapter height after the position was
 * restored. Correct it when that happens - but only while the reader is sitting
 * exactly where it was put, otherwise this would yank the page from under
 * someone who has already started reading.
 */
const correctReadingPosition = () => {
  if (reader.generalSettings.val.pageReader || restoredScrollTop === null) {
    return;
  }

  const previousHeight = reader.chapterHeight;
  reader.refresh();
  if (
    reader.chapterHeight !== previousHeight &&
    Math.abs(window.scrollY - Math.max(0, restoredScrollTop)) < 4
  ) {
    calculatePages();
  }
};

const restoreReadingPosition = () => {
  requestAnimationFrame(() =>
    setTimeout(() => {
      positionRestored = true;
      calculatePages();
      // A chapter that fits on one screen never scrolls, which is otherwise
      // what asks for the next chapter.
      window.continuousScroll.update();
      // Deliberately not awaited before restoring: `document.fonts.ready` does
      // not resolve until the document has finished loading, which is what this
      // is trying to avoid waiting for.
      document.fonts.ready.then(correctReadingPosition);
    }, 0),
  );
};

// Restore as soon as the chapter itself is parsed and styled. Waiting for
// `load` means waiting for every image in the chapter, which can take seconds -
// the reader would sit at the top of the chapter until then.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', restoreReadingPosition, {
    once: true,
  });
} else {
  restoreReadingPosition();
}

window.addEventListener('load', () => {
  if (!positionRestored) {
    restoreReadingPosition();
    return;
  }

  if (reader.generalSettings.val.pageReader) {
    schedulePageCalculation();
  } else {
    correctReadingPosition();
  }
});

// click handler
(function () {
  const detectTapPosition = (x, y, horizontal) => {
    if (horizontal) {
      if (x < 0.33) {
        return 'left';
      }
      if (x > 0.66) {
        return 'right';
      }
    } else {
      if (y < 0.33) {
        return 'top';
      }
      if (y > 0.66) {
        return 'bottom';
      }
    }
    return 'center';
  };
  document.onclick = e => {
    if (Date.now() < pageReader.ignoreClickUntil) {
      return;
    }
    const { clientX, clientY } = e;
    const { x, y } = {
      x: clientX / reader.layoutWidth,
      y: clientY / reader.layoutHeight,
    };

    if (reader.generalSettings.val.pageReader) {
      const position = detectTapPosition(x, y, true);
      if (position === 'left') {
        pageReader.movePage(pageReader.page.val - 1);
        return;
      }
      if (position === 'right') {
        pageReader.movePage(pageReader.page.val + 1);
        return;
      }
    } else {
      if (reader.generalSettings.val.tapToScroll) {
        const position = detectTapPosition(x, y, false);
        if (position === 'top') {
          window.scrollBy({
            top: -reader.layoutHeight * 0.75,
            behavior: 'smooth',
          });
          return;
        }
        if (position === 'bottom') {
          window.scrollBy({
            top: reader.layoutHeight * 0.75,
            behavior: 'smooth',
          });
          return;
        }
      }
    }
    reader.post({ type: 'hide' });
  };
})();

// swipe handler
(function () {
  this.initialX = null;
  this.initialY = null;

  const onTouchStart = e => {
    this.initialX = e.changedTouches[0].screenX;
    this.initialY = e.changedTouches[0].screenY;
  };

  const onTouchMove = e => {
    if (reader.generalSettings.val.pageReader) {
      const diffX =
        (e.changedTouches[0].screenX - this.initialX) / reader.layoutWidth;
      reader.chapterElement.style.transition = 'unset';
      reader.chapterElement.style.transform =
        'translateX(-' + (pageReader.page.val - diffX) * 100 + '%)';
    }
  };

  const onTouchEnd = e => {
    const diffX = e.changedTouches[0].screenX - this.initialX;
    const diffY = e.changedTouches[0].screenY - this.initialY;
    if (reader.generalSettings.val.pageReader) {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        pageReader.ignoreClickUntil = Date.now() + 400;
      }
      reader.chapterElement.style.transition = reader.generalSettings.val
        .pageReaderDisableAnimation
        ? 'none'
        : 'transform 200ms';
      reader.chapterElement.style.removeProperty('transition');
      const diffXPercentage = diffX / reader.layoutWidth;
      if (diffXPercentage < -0.3) {
        pageReader.movePage(pageReader.page.val + 1);
      } else if (diffXPercentage > 0.3) {
        pageReader.movePage(pageReader.page.val - 1);
      } else {
        pageReader.movePage(pageReader.page.val);
      }
      return;
    }
    if (
      e.target.id?.startsWith('scrollbar') ||
      e.target.id === 'Image-Modal-img'
    ) {
      return;
    }
    if (
      diffY > 80 &&
      Math.abs(diffY) > Math.abs(diffX) * 2 &&
      window.scrollY <= 0
    ) {
      e.preventDefault();
      reader.post({ type: 'refresh' });
      return;
    }
    if (
      reader.generalSettings.val.swipeGestures &&
      Math.abs(diffX) > Math.abs(diffY) * 2 &&
      Math.abs(diffX) > 180
    ) {
      if (diffX < 0 && this.initialX >= window.innerWidth / 2) {
        e.preventDefault();
        reader.post({ type: 'next' });
      } else if (diffX > 0 && this.initialX <= window.innerWidth / 2) {
        e.preventDefault();
        reader.post({ type: 'prev' });
      }
    }
  };

  reader.attachChapterGestures = element => {
    element.addEventListener('touchstart', onTouchStart);
    element.addEventListener('touchmove', onTouchMove);
    element.addEventListener('touchend', onTouchEnd);
  };
  reader.attachChapterGestures(reader.chapterElement);
})();

// text options
(function () {
  const transformHTML = (rawHTML, settings) => {
    let html = rawHTML;
    if (settings.bionicReading) {
      html = textVide.textVide(rawHTML);
    }

    if (settings.removeExtraParagraphSpacing) {
      html = html
        .replace(/(?:&nbsp;\s*|[\u200b]\s*)+(?=<\/?p[> ])/g, '')
        .replace(/<br>\s*<br>\s*(?:<br>\s*)+/g, '<br><br>') //force max 2 consecutive <br>, chaining regex
        .replace(
          /<br>\s*<br>[^]+/,
          _ =>
            `${
              /\/p>/.test(_)
                ? _.replace(
                    /<br>\s*<br>(?:(?=\s*<\/?p[> ])|(?<=<\/?p(?:>| [^>]+>)<br>\s*<br>))\s*/g,
                    '',
                  )
                : _
            }`,
        ) //if p found, delete all double br near p
        .replace(
          /<br>(?:(?=\s*<\/?p[> ])|(?<=<\/?p(?:>| [^>]+>)(?:<[^>]+>)*\s*<br>))\s*/g,
          '',
        );
    }
    return html;
  };

  /**
   * Writes a chapter's transformed markup into its element. `appliedHTML` is
   * what the element currently holds: the document is delivered with the
   * untransformed chapter already parsed, so writing the same markup back
   * would re-parse and re-layout the whole chapter (and restart image loads)
   * for nothing - which is exactly what happens when neither transform is on.
   */
  reader.renderChapterHTML = (
    segment,
    settings = reader.generalSettings.val,
  ) => {
    const html = transformHTML(segment.rawHTML, settings);
    if (html === segment.appliedHTML) {
      return false;
    }
    segment.element.innerHTML = html;
    segment.appliedHTML = html;
    return true;
  };

  reader.segments[0].appliedHTML = reader.segments[0].rawHTML;

  van.derive(() => {
    const settings = reader.generalSettings.val;
    let changed = false;
    for (const segment of reader.segments) {
      changed = reader.renderChapterHTML(segment, settings) || changed;
    }
    if (!changed) {
      return;
    }

    reader.refresh();
    schedulePageCalculation();

    // Replacing the markup dropped the highlights, so restore the search.
    const searchQuery = window.readerSearch?.query;
    const searchIndex = window.readerSearch?.index;
    if (searchQuery) {
      window.readerSearch.search(searchQuery, searchIndex);
    }
  });
})();
