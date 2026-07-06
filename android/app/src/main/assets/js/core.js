/* eslint-disable no-console */
window.reader = new (function () {
  const {
    readerSettings,
    chapterGeneralSettings,
    novel,
    chapter,
    nextChapter,
    prevChapter,
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

  this.chapterElement = document.querySelector('#LNReader-chapter');
  this.selection = window.getSelection();
  this.viewport = document.querySelector('meta[name=viewport]');

  this.novel = novel;
  this.chapter = chapter;
  this.nextChapter = nextChapter;
  this.prevChapter = prevChapter;
  this.strings = strings;
  this.autoSaveInterval = autoSaveInterval;
  this.rawHTML = this.chapterElement.innerHTML;

  //layout props
  this.paddingTop = parseInt(
    getComputedStyle(document.querySelector('body')).getPropertyValue(
      'padding-top',
    ),
    10,
  );
  this.chapterHeight = this.chapterElement.scrollHeight + this.paddingTop;
  this.layoutHeight = window.screen.height;
  this.layoutWidth = window.screen.width;

  this.layoutEvent = undefined;
  this.chapterEndingVisible = van.state(false);

  this.post = obj => window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  this.refresh = () => {
    if (this.generalSettings.val.pageReader) {
      this.chapterWidth = this.chapterElement.scrollWidth;
    } else {
      this.chapterHeight = this.chapterElement.scrollHeight + this.paddingTop;
    }
  };

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
    if (settings.fontFamily) {
      new FontFace(
        settings.fontFamily,
        'url("file:///android_asset/fonts/' + settings.fontFamily + '.ttf")',
      )
        .load()
        .then(function (loadedFont) {
          document.fonts.add(loadedFont);
        });
    } else {
      // have no affect with a font declared in head
      document.fonts.forEach(fontFace => document.fonts.delete(fontFace));
    }
  });

  document.onscrollend = () => {
    if (!this.generalSettings.val.pageReader) {
      this.post({
        type: 'save',
        data: parseInt(
          ((window.scrollY + this.layoutHeight) / this.chapterHeight) * 100,
          10,
        ),
      });
    }
  };

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
    return text
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([.,!?;:])\s*/g, '$1 ')
      .trim();
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
    try {
      this.currentElement?.classList?.remove('highlight');

      // Use array-based approach instead of DOM traversal (no recursion!)
      while (this.elementsRead < this.totalElements) {
        const nextElement = this.allReadableElements[this.elementsRead];
        if (!nextElement) break;

        const text = this.normalizeText(nextElement.innerText);
        if (text) {
          // Found valid text - speak it
          this.currentElement = nextElement;
          this.reading = true;
          this.elementsRead++;
          this.speak();
          return;
        } else {
          // Empty text, skip to next in array (no recursion!)
          this.elementsRead++;
        }
      }

      // Reached the end (elementsRead >= totalElements or no more valid elements)
      this.reading = false;
      const autoPageAdvance =
        reader.readerSettings.val.tts?.autoPageAdvance === true;
      const hasNextChapter = !!reader.nextChapter;

      if (autoPageAdvance && hasNextChapter) {
        reader.post({ type: 'next', autoStartTTS: true });
      } else {
        this.stop();
        const controller = document.getElementById('TTS-Controller');
        if (controller?.firstElementChild) {
          controller.firstElementChild.innerHTML = volumnIcon;
        }
      }
    } catch (e) {
      this.stop();
      alert('TTS Error: ' + e.message);
    }
  };

  this.start = element => {
    this.stop();
    this.started = true;
    const startElement = element ?? reader.chapterElement;
    this.currentElement = startElement;

    // Get all readable elements from the chapter
    this.allReadableElements = this.getAllReadableElements(
      reader.chapterElement,
    );
    this.totalElements = this.allReadableElements.length;
    this.textQueue = this.allReadableElements
      .map(el => this.normalizeText(el.innerText))
      .filter(text => !!text);
    reader.post({
      type: 'tts-queue',
      data: {
        queue: this.textQueue,
        startIndex: this.elementsRead,
      },
    });

    // If starting from a specific element, count how many are before it
    if (element && element !== reader.chapterElement) {
      const startIndex = this.allReadableElements.indexOf(element);
      this.elementsRead = startIndex >= 0 ? startIndex : 0;
    } else {
      this.elementsRead = 0;
    }

    this.next();
  };

  // Get all readable elements in order
  this.getAllReadableElements = element => {
    const elements = [];
    const traverse = el => {
      if (!el) return;
      if (this.readable(el)) {
        elements.push(el);
      }
      for (let i = 0; i < el.children.length; i++) {
        traverse(el.children[i]);
      }
    };
    traverse(element);
    return elements;
  };

  this.resume = () => {
    if (!this.reading) {
      if (
        this.currentElement &&
        this.currentElement.id !== 'LNReader-chapter'
      ) {
        this.speak();
        this.reading = true;
      } else {
        this.next();
      }
    }
  };

  this.pause = () => {
    this.reading = false;
    reader.post({ type: 'pause-speak' });
    reader.post({ type: 'tts-state', data: { isReading: false } });
  };

  this.rewind = () => {
    if (!this.started || !this.currentElement) return;
    reader.post({ type: 'pause-speak' });
    this.reading = true;
    this.speak();
  };

  this.seekTo = index => {
    if (!this.started || !this.allReadableElements.length) return;
    const targetIndex = Math.max(0, Math.min(index, this.totalElements - 1));
    reader.post({ type: 'pause-speak' });
    this.currentElement?.classList?.remove('highlight');
    this.elementsRead = targetIndex;
    this.currentElement = this.allReadableElements[targetIndex];
    this.reading = true;
    this.elementsRead++;
    this.speak();
  };

  this.stop = () => {
    reader.post({ type: 'stop-speak' });
    this.currentElement?.classList?.remove('highlight');
    this.prevElement = null;
    this.currentElement = reader.chapterElement;
    this.started = false;
    this.reading = false;
    this.elementsRead = 0;
    this.totalElements = 0;
    this.allReadableElements = [];
    this.textQueue = [];
    reader.post({ type: 'tts-state', data: { isReading: false } });
    // Ensure icon updates to stopped state
    const controller = document.getElementById('TTS-Controller');
    if (controller?.firstElementChild) {
      controller.firstElementChild.innerHTML = volumnIcon;
    }
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
    if (!this.currentElement) return;
    this.prevElement = this.currentElement;
    this.scrollToElement(this.currentElement);
    this.currentElement.classList.add('highlight');
    const text = this.normalizeText(this.currentElement.innerText);
    if (text) {
      reader.post({
        type: 'speak',
        data: text,
        index: this.elementsRead - 1,
        total: this.totalElements,
      });
      reader.post({ type: 'tts-state', data: { isReading: true } });
    } else {
      this.next();
    }
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

window.pageReader = new (function () {
  this.page = van.state(0);
  this.totalPages = van.state(0);
  this.chapterEndingVisible = van.state(
    initialPageReaderConfig.nextChapterScreenVisible,
  );
  this.chapterEnding = document.getElementsByClassName('transition-chapter')[0];

  this.showChapterEnding = (bool, instant, left) => {
    if (!this.chapterEnding) {
      this.chapterEnding =
        document.getElementsByClassName('transition-chapter')[0];
      if (!this.chapterEnding) return;
    }
    this.chapterEnding.style.transition = 'unset';
    if (bool) {
      this.chapterEnding.style.transform = `translateX(${left ? -200 : 0}vw)`;
      requestAnimationFrame(() => {
        if (!instant) this.chapterEnding.style.transition = '200ms';
        this.chapterEnding.style.transform = 'translateX(-100vw)';
      });
      this.chapterEndingVisible.val = true;
    } else {
      if (!instant) this.chapterEnding.style.transition = '200ms';
      this.chapterEnding.style.transform = `translateX(${left ? -200 : 0}vw)`;
      this.chapterEndingVisible.val = false;
    }
  };

  this.movePage = destPage => {
    if (this.chapterEndingVisible.val) {
      if (destPage < 0) {
        this.showChapterEnding(false);
        return;
      }
      if (destPage < this.totalPages.val) {
        this.showChapterEnding(false, false, true);
        return;
      }
      if (destPage >= this.totalPages.val) {
        return reader.post({ type: 'next' });
      }
    }
    destPage = parseInt(destPage, 10);
    if (destPage < 0) {
      document.getElementsByClassName('transition-chapter')[0].innerText =
        reader.prevChapter.name;
      this.showChapterEnding(true, false, true);
      setTimeout(() => {
        reader.post({ type: 'prev' });
      }, 200);
      return;
    }
    if (destPage >= this.totalPages.val) {
      document.getElementsByClassName('transition-chapter')[0].innerText =
        reader.nextChapter.name;
      this.showChapterEnding(true);
      setTimeout(() => {
        reader.post({ type: 'next' });
      }, 200);
      return;
    }
    this.page.val = destPage;
    reader.chapterElement.style.transform =
      'translateX(-' + destPage * 100 + '%)';

    const newProgress = parseInt(
      ((pageReader.page.val + 1) / pageReader.totalPages.val) * 100,
      10,
    );

    if (newProgress > reader.chapter.progress) {
      reader.post({
        type: 'save',
        data: parseInt(
          ((pageReader.page.val + 1) / pageReader.totalPages.val) * 100,
          10,
        ),
      });
    }
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
        (window.scrollY + reader.layoutHeight) / reader.chapterHeight,
      );
      document.body.classList.add('page-reader');
      setTimeout(() => {
        reader.refresh();
        this.totalPages.val = parseInt(
          (reader.chapterWidth + reader.readerSettings.val.padding * 2) /
            reader.layoutWidth,
          10,
        );
        this.movePage(this.totalPages.val * ratio);
      }, 100);
    } else {
      reader.chapterElement.style = '';
      document.body.classList.remove('page-reader');
      setTimeout(() => {
        reader.refresh();
        window.scrollTo({
          top:
            (reader.chapterHeight * (this.page.val + 1)) / this.totalPages.val -
            reader.layoutHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  if (pageReader.chapterEndingVisible.val) {
    pageReader.showChapterEnding(true, true);
  }
});

function calculatePages() {
  reader.refresh();

  if (reader.generalSettings.val.pageReader) {
    pageReader.totalPages.val = parseInt(
      (reader.chapterWidth + reader.readerSettings.val.padding * 2) /
        reader.layoutWidth,
      10,
    );

    if (initialPageReaderConfig.nextChapterScreenVisible) return;

    pageReader.movePage(
      Math.max(
        0,
        Math.round(
          (pageReader.totalPages.val * reader.chapter.progress) / 100,
        ) - 1,
      ),
    );
  } else {
    window.scrollTo({
      top:
        (reader.chapterHeight * reader.chapter.progress) / 100 -
        reader.layoutHeight,
      behavior: 'smooth',
    });
  }
}

const ro = new ResizeObserver(() => {
  if (pageReader.totalPages.val) {
    calculatePages();
  }
});
ro.observe(reader.chapterElement);

// Also call once on load
window.addEventListener('load', () => {
  document.fonts.ready.then(() => {
    requestAnimationFrame(() => setTimeout(calculatePages, 0));
  });
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

  reader.chapterElement.addEventListener('touchstart', e => {
    this.initialX = e.changedTouches[0].screenX;
    this.initialY = e.changedTouches[0].screenY;
  });

  reader.chapterElement.addEventListener('touchmove', e => {
    if (reader.generalSettings.val.pageReader) {
      const diffX =
        (e.changedTouches[0].screenX - this.initialX) / reader.layoutWidth;
      reader.chapterElement.style.transition = 'unset';
      reader.chapterElement.style.transform =
        'translateX(-' + (pageReader.page.val - diffX) * 100 + '%)';
    }
  });

  reader.chapterElement.addEventListener('touchend', e => {
    const diffX = e.changedTouches[0].screenX - this.initialX;
    const diffY = e.changedTouches[0].screenY - this.initialY;
    if (reader.generalSettings.val.pageReader) {
      reader.chapterElement.style.transition = '200ms';
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
  });
})();

window.readerSearch = new (function () {
  const MIN_QUERY_LENGTH = 1;
  const SEGMENT_BATCH_SIZE = 80;
  const MAX_RENDERED_MATCHES = 1500;
  const INLINE_TEXT_ELEMENTS = new Set([
    'A',
    'ABBR',
    'B',
    'BDI',
    'BDO',
    'CITE',
    'CODE',
    'DATA',
    'DFN',
    'EM',
    'I',
    'KBD',
    'MARK',
    'Q',
    'RP',
    'RT',
    'RUBY',
    'S',
    'SAMP',
    'SMALL',
    'SPAN',
    'STRONG',
    'SUB',
    'SUP',
    'TIME',
    'U',
    'VAR',
    'WBR',
  ]);

  this.query = '';
  this.index = -1;
  this.matches = [];
  this.total = 0;
  this.isTruncated = false;
  this.searchToken = 0;
  this.pendingSearchTimer = null;

  this.emit = (query = this.query) => {
    reader.post({
      type: 'search-result',
      data: {
        query,
        current: this.index >= 0 ? this.index + 1 : 0,
        total: this.total,
        renderedTotal: this.matches.length,
        isTruncated: this.isTruncated,
      },
    });
  };

  this.cancelPendingSearch = () => {
    this.searchToken += 1;

    if (this.pendingSearchTimer !== null) {
      clearTimeout(this.pendingSearchTimer);
      this.pendingSearchTimer = null;
    }
  };

  this.refreshLayout = () => {
    reader.refresh();

    if (!reader.generalSettings.val.pageReader || !window.pageReader) {
      return;
    }

    const totalPages = parseInt(
      (reader.chapterWidth + reader.readerSettings.val.padding * 2) /
        reader.layoutWidth,
      10,
    );

    if (!Number.isFinite(totalPages) || totalPages <= 0) {
      return;
    }

    pageReader.totalPages.val = totalPages;

    if (pageReader.page.val >= totalPages) {
      pageReader.movePage(totalPages - 1);
    }
  };

  this.resetMatches = () => {
    const touchedParents = new Set();

    document.querySelectorAll('mark.lnreader-search-match').forEach(mark => {
      const parent = mark.parentNode;
      if (!parent) {
        return;
      }

      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      touchedParents.add(parent);
    });

    touchedParents.forEach(parent => {
      parent.normalize();
    });

    this.matches = [];
    this.index = -1;
    this.total = 0;
    this.isTruncated = false;
    this.refreshLayout();
  };

  this.clear = (emit = true, resetQuery = true) => {
    this.cancelPendingSearch();

    if (resetQuery) {
      this.query = '';
    }

    this.resetMatches();

    if (emit) {
      this.emit();
    }
  };

  this.getTextBlock = node => {
    let element = node.parentElement;

    while (
      element &&
      element !== reader.chapterElement &&
      INLINE_TEXT_ELEMENTS.has(element.nodeName)
    ) {
      element = element.parentElement;
    }

    return element || reader.chapterElement;
  };

  this.hasElementBetween = (previousNode, nextNode, selector) => {
    const range = document.createRange();

    try {
      range.setStartAfter(previousNode);
      range.setEndBefore(nextNode);
      return !!range.cloneContents().querySelector(selector);
    } catch {
      return false;
    } finally {
      range.detach?.();
    }
  };

  this.getTextSegments = () => {
    const segments = [];
    const textNodes = [];
    const walker = document.createTreeWalker(
      reader.chapterElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: node => {
          if (!node.nodeValue) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.parentElement?.closest('script, style')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );
    let node = walker.nextNode();

    while (node) {
      textNodes.push(node);
      node = walker.nextNode();
    }

    textNodes.forEach(textNode => {
      const block = this.getTextBlock(textNode);
      const previousSegment = segments[segments.length - 1];
      const previousEntry =
        previousSegment?.entries[previousSegment.entries.length - 1];
      const startsNewSegment =
        !previousSegment ||
        previousSegment.block !== block ||
        this.hasElementBetween(
          previousEntry.node,
          textNode,
          'br, hr, img, table, ul, ol',
        );

      if (startsNewSegment) {
        segments.push({
          block,
          entries: [],
          text: '',
        });
      }

      const segment = segments[segments.length - 1];
      const start = segment.text.length;
      const text = textNode.nodeValue || '';

      segment.entries.push({
        end: start + text.length,
        node: textNode,
        start,
      });
      segment.text += text;
    });

    return segments.filter(segment => segment.text.trim());
  };

  this.findSegmentMatches = (segment, normalizedTerm) => {
    const matches = [];
    const normalizedText = segment.text.toLowerCase();
    let matchIndex = normalizedText.indexOf(normalizedTerm);

    while (matchIndex !== -1) {
      matches.push(matchIndex);
      matchIndex = normalizedText.indexOf(
        normalizedTerm,
        matchIndex + normalizedTerm.length,
      );
    }

    return matches;
  };

  this.getTextPosition = (segment, offset, preferPrevious = false) => {
    for (const entry of segment.entries) {
      if (offset >= entry.start && offset < entry.end) {
        return {
          node: entry.node,
          offset: offset - entry.start,
        };
      }

      if (preferPrevious && offset === entry.end) {
        return {
          node: entry.node,
          offset: entry.node.nodeValue?.length || 0,
        };
      }
    }

    const entry = segment.entries[segment.entries.length - 1];
    return {
      node: entry.node,
      offset: entry.node.nodeValue?.length || 0,
    };
  };

  this.removeEmptyInlineTextElement = node => {
    if (
      !node ||
      node.nodeType !== Node.ELEMENT_NODE ||
      !INLINE_TEXT_ELEMENTS.has(node.nodeName) ||
      node.textContent ||
      node.querySelector('img, svg, canvas, video, audio, iframe')
    ) {
      return;
    }

    const parent = node.parentNode;
    parent?.removeChild(node);
    this.removeEmptyInlineTextElement(parent);
  };

  this.wrapSegmentMatch = (segment, start, length) => {
    const end = start + length;
    const range = document.createRange();
    const mark = document.createElement('mark');
    const startPosition = this.getTextPosition(segment, start);
    const endPosition = this.getTextPosition(segment, end, true);

    mark.className = 'lnreader-search-match';
    range.setStart(startPosition.node, startPosition.offset);
    range.setEnd(endPosition.node, endPosition.offset);
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
    this.removeEmptyInlineTextElement(mark.previousSibling);
    this.removeEmptyInlineTextElement(mark.nextSibling);
    range.detach?.();
  };

  this.hasLiveMatches = () => {
    return (
      this.matches.length > 0 &&
      this.matches.every(match => reader.chapterElement.contains(match))
    );
  };

  this.ensureSearch = query => {
    const term = String(query ?? this.query ?? '').trim();
    if (!term) {
      this.clear();
      return false;
    }

    if (term !== this.query || !this.hasLiveMatches()) {
      this.search(term, Math.max(0, this.index));
    }

    return this.matches.length > 0;
  };

  this.scrollToMatch = match => {
    if (reader.generalSettings.val.pageReader && window.pageReader) {
      const rect = match.getBoundingClientRect();
      const relativePage = Math.floor(
        (rect.left + rect.width / 2) / reader.layoutWidth,
      );
      const page = Math.max(
        0,
        Math.min(
          pageReader.totalPages.val - 1,
          pageReader.page.val + relativePage,
        ),
      );
      pageReader.movePage(page);
      return;
    }

    match.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  this.focus = index => {
    if (!this.matches.length) {
      this.index = -1;
      this.emit();
      return;
    }

    this.matches[this.index]?.classList.remove(
      'lnreader-search-match-active',
    );
    this.index =
      ((index % this.matches.length) + this.matches.length) %
      this.matches.length;

    const match = this.matches[this.index];
    match.classList.add('lnreader-search-match-active');
    this.scrollToMatch(match);
    this.emit();
  };

  this.finishSearch = (query, preferredIndex, total) => {
    this.pendingSearchTimer = null;
    this.matches = Array.from(
      reader.chapterElement.querySelectorAll('mark.lnreader-search-match'),
    );
    this.total = total;
    this.isTruncated = this.matches.length < this.total;
    this.refreshLayout();

    if (!this.matches.length) {
      this.emit(query);
      return;
    }

    this.focus(Math.max(0, Math.min(preferredIndex, this.matches.length - 1)));
  };

  this.search = (query, preferredIndex = 0) => {
    const term = String(query ?? '').trim();
    this.cancelPendingSearch();
    this.resetMatches();
    this.query = term;

    if (!term || term.length < MIN_QUERY_LENGTH) {
      this.emit(term);
      return;
    }

    const searchToken = this.searchToken;
    const normalizedTerm = term.toLowerCase();
    const textSegments = this.getTextSegments();
    let textSegmentIndex = 0;
    let totalMatchCount = 0;
    let renderedMatchCount = 0;

    const processBatch = () => {
      if (searchToken !== this.searchToken || term !== this.query) {
        this.pendingSearchTimer = null;
        return;
      }

      const batchEnd = Math.min(
        textSegmentIndex + SEGMENT_BATCH_SIZE,
        textSegments.length,
      );

      while (textSegmentIndex < batchEnd) {
        const segment = textSegments[textSegmentIndex];
        const matches = this.findSegmentMatches(segment, normalizedTerm);
        const renderableMatches = matches.slice(
          0,
          Math.max(0, MAX_RENDERED_MATCHES - renderedMatchCount),
        );

        renderableMatches.reverse().forEach(matchIndex => {
          this.wrapSegmentMatch(segment, matchIndex, normalizedTerm.length);
        });

        renderedMatchCount += renderableMatches.length;
        totalMatchCount += matches.length;
        textSegmentIndex += 1;
      }

      if (textSegmentIndex < textSegments.length) {
        this.pendingSearchTimer = setTimeout(processBatch, 0);
        return;
      }

      this.finishSearch(term, preferredIndex, totalMatchCount);
    };

    processBatch();
  };

  this.next = query => {
    if (this.ensureSearch(query)) {
      this.focus(this.index + 1);
    }
  };

  this.previous = query => {
    if (this.ensureSearch(query)) {
      this.focus(this.index - 1);
    }
  };
})();

// text options
(function () {
  van.derive(() => {
    let html = reader.rawHTML;
    if (reader.generalSettings.val.bionicReading) {
      html = textVide.textVide(reader.rawHTML);
    }

    if (reader.generalSettings.val.removeExtraParagraphSpacing) {
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
        .replace(/<br>(?:(?=\s*<\/?p[> ])|(?<=<\/?p(?:>| [^>]+>)(?:<[^>]+>)*\s*<br>))\s*/g, '');
    }
    reader.chapterElement.innerHTML = html;
    const searchQuery = window.readerSearch?.query;
    const searchIndex = window.readerSearch?.index;
    if (searchQuery) {
      window.readerSearch.search(searchQuery, searchIndex);
    }
  });
})();
