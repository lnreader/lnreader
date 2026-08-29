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
  this.rawHTML = this.chapterElement.innerHTML;

  //layout props
  this.paddingTop = parseInt(
    getComputedStyle(document.querySelector('body')).getPropertyValue(
      'padding-top',
    ),
    10,
  );
  this.chapterHeight = this.chapterElement.scrollHeight + this.paddingTop;
  this.layoutHeight = window.innerHeight;
  this.layoutWidth = window.innerWidth;

  this.layoutEvent = undefined;
  this.chapterEndingVisible = van.state(false);

  this.post = obj => window.ReactNativeWebView.postMessage(JSON.stringify(obj));
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
      this.chapterHeight = this.chapterElement.scrollHeight + this.paddingTop;
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
      this.post({
        type: 'save',
        data: parseInt(
          ((window.scrollY + this.layoutHeight) / this.chapterHeight) * 100,
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
  this.wordMap = null; // Normalized text + DOM offsets for the active paragraph
  this.highlightEnabled = true;
  this.highlightColor = '';
  this.userScrolling = false; // set while the user drags the page

  if (typeof document !== 'undefined') {
    // Tracks user-initiated page drags. The paragraph follow stays paused while
    // the user is dragging and re-engages shortly after they let go. Android
    // WebViews don't always fire `scrollend` (taps, older engines), so a
    // watchdog clears `userScrolling` ~700ms after the last scroll activity
    // instead of depending on the event alone.
    const clearScrolling = () => {
      if (this.scrollWatchdog) {
        clearTimeout(this.scrollWatchdog);
        this.scrollWatchdog = null;
      }
      this.userScrolling = false;
    };
    const armScrollingWatchdog = () => {
      if (this.scrollWatchdog) clearTimeout(this.scrollWatchdog);
      this.scrollWatchdog = setTimeout(() => {
        this.scrollWatchdog = null;
        this.userScrolling = false;
      }, 700);
    };
    document.addEventListener(
      'pointerdown',
      () => {
        if (this.started) {
          this.userScrolling = true;
          armScrollingWatchdog();
        }
      },
      true,
    );
    document.addEventListener(
      'scroll',
      () => {
        if (this.userScrolling) armScrollingWatchdog();
      },
      true,
    );
    document.addEventListener('scrollend', clearScrolling, true);
  }

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

  // Shared token pipeline for normalizeText/normalizeWithOffsets. Every output
  // char carries the raw code-unit offset it was derived from, so the spoken
  // text and the highlight ranges stay aligned by construction.
  const TTS_DECORATIVE = /[\-=*_~+#·•°─-┿]/;
  const TTS_LEADING_DECORATIVE = /^[\-=*_~+#·•°─-┿]{3,}\s*/;
  const TTS_TRAILING_DECORATIVE = /\s*[\-=*_~+#·•°─-┿]{3,}$/;
  const TTS_QUOTE = /["'“”‘’]/;

  this.normalizeTokens = raw => {
    if (!raw) return { chars: [], src: [] };
    const chars = [];
    const src = [];
    const lines = raw.split(/\r\n|\r|\n/);
    let base = 0;
    let prevLineHadContent = false;
    for (const line of lines) {
      // NoveLA's cleanTextForTts: strip decorative separator runs bordering
      // each line (scene-break rules like ----, ***, ────), then trim.
      let from = 0;
      let to = line.length;
      const lead = TTS_LEADING_DECORATIVE.exec(line);
      if (lead) from = lead[0].length;
      const trail = TTS_TRAILING_DECORATIVE.exec(line);
      if (trail) to = trail.index;
      while (from < to && /\s/.test(line[from])) from++;
      while (to > from && /\s/.test(line[to - 1])) to--;
      if (to > from) {
        // Adjacent text lines collapse into a single space, mapping onto the
        // separator that used to sit between them.
        if (prevLineHadContent) {
          chars.push(' ');
          src.push(Math.max(base - 1, 0));
        }
        for (let i = from; i < to; i++) {
          chars.push(line[i]);
          src.push(base + i);
        }
        prevLineHadContent = true;
      }
      base += line.length + 1;
    }
    const collapsed = [];
    const collapsedSrc = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (/\s/.test(c)) {
        if (collapsed.length > 0 && collapsed[collapsed.length - 1] !== ' ') {
          collapsed.push(' ');
          collapsedSrc.push(src[i]);
        }
      } else {
        collapsed.push(c);
        collapsedSrc.push(src[i]);
      }
    }
    // Upstream LNReader: trim, then strip surrounding quote runs so the engine
    // never reads stray " ... " as the word "quote".
    let start = 0;
    let end = collapsed.length;
    while (start < end && collapsed[start] === ' ') start++;
    while (end > start && collapsed[end - 1] === ' ') end--;
    while (start < end && TTS_QUOTE.test(collapsed[start])) start++;
    while (end > start && TTS_QUOTE.test(collapsed[end - 1])) end--;
    const out = [];
    const outSrc = [];
    for (let i = start; i < end; i++) {
      const c = collapsed[i];
      if (/[.,!?;:]/.test(c)) {
        // The punctuation rule strips only a real preceding space (not the
        // synthetic one a previous punctuation emitted), mirroring the regex
        // which never re-scans its own replacements.
        if (
          i > start &&
          collapsed[i - 1] === ' ' &&
          out[out.length - 1] === ' '
        ) {
          out.pop();
          outSrc.pop();
        }
        out.push(c);
        outSrc.push(collapsedSrc[i]);
        if (i + 1 < end && collapsed[i + 1] === ' ') {
          out.push(' ');
          outSrc.push(collapsedSrc[i + 1]);
          i++;
        } else {
          out.push(' ');
          outSrc.push(collapsedSrc[i]);
        }
      } else {
        out.push(c);
        outSrc.push(collapsedSrc[i]);
      }
    }
    let from = 0;
    let to = out.length;
    while (from < to && out[from] === ' ') from++;
    while (to > from && out[to - 1] === ' ') to--;
    return { chars: out.slice(from, to), src: outSrc.slice(from, to) };
  };

  this.normalizeText = text => {
    if (!text) return '';
    return this.normalizeTokens(text).chars.join('');
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
    this.clearWordHighlight();
    this.wordMap = null;
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
    this.clearWordHighlight();
    this.currentElement = this.allReadableElements[targetIndex];
    this.elementsRead = targetIndex + 1;
    this.started = true;
    const mapped = this.mapFromElement(this.currentElement);
    if (mapped) {
      mapped.paragraphId = String(targetIndex);
      this.wordMap = mapped;
    }
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

  // Scrolls the active paragraph to a ~20% anchor line (like NoveLA's TTS
  // follow), re-anchoring smoothly within a viewport and jumping otherwise.
  // Only kick in once the user's own scroll has settled.
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
    if (this.userScrolling) return;
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;

    const scrollToTop = reader.readerSettings.val.tts?.scrollToTop !== false;

    if (!scrollToTop) {
      // Center scroll (toggle disabled)
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
      return;
    }

    // Anchors the paragraph top near the top of the viewport (~8%), clamped to
    // a sane band so short windows still leave breathing room above the text.
    const anchor = Math.min(Math.max(Math.round(windowHeight * 0.08), 70), 160);
    const elementTop = rect.top + window.pageYOffset;
    const targetScroll = elementTop - anchor;
    const delta = targetScroll - window.pageYOffset;

    // Already positioned around the anchor line, or still safely in view
    // without a tighter anchor above it.
    if (Math.abs(delta) <= 16) return;
    if (rect.top >= 0 && rect.bottom <= windowHeight) return;

    const smooth = Math.abs(delta) <= windowHeight;
    window.scrollTo({
      top: Math.max(targetScroll, 0),
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  // Flattens an element's text into `normalizeText`-equivalent output while
  // recording, for every output character, the raw code-unit offset it came
  // from. Native engines report spoken ranges relative to the very string they
  // were handed (`normalizeText(el.innerText)`), so this map lets those ranges
  // be translated back onto the DOM nodes that render that text.
  this.mapFromElement = element => {
    if (!element || typeof element.childNodes === 'undefined') return null;
    const segments = [];
    let raw = '';
    const isRendered = el => {
      try {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      } catch (error) {
        return true;
      }
    };
    const walk = el => {
      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        if (child.nodeType === Node.TEXT_NODE) {
          segments.push({
            node: child,
            start: raw.length,
            end: raw.length + child.data.length,
          });
          raw += child.data;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.nodeName === 'BR') {
            raw += '\n';
          } else if (isRendered(child)) {
            walk(child);
          }
        }
      }
    };
    walk(element);
    if (!raw) return null;
    const { text, offsets } = this.normalizeWithOffsets(raw);
    if (!text) return null;
    return { element, text, offsets, segments };
  };

  // Offset-tracked twin of normalizeText: both run the same token pipeline, so
  // the spoken queue text and the highlight map can never drift apart.
  this.normalizeWithOffsets = raw => {
    if (!raw) return { text: '', offsets: [] };
    const { chars, src } = this.normalizeTokens(raw);
    return { text: chars.join(''), offsets: src };
  };

  // Turns a normalized [start,end) span into one DOM Range per text-node run.
  this.rangesFor = (map, start, end) => {
    if (!map || !map.text) return [];
    const lo = Math.max(0, Math.floor(start));
    const hi = Math.min(map.text.length, Math.ceil(end));
    if (hi <= lo || !map.offsets || !map.segments) return [];
    const seen = new Set();
    const positions = [];
    for (let i = lo; i < hi; i++) {
      const offset = map.offsets[i];
      if (!seen.has(offset)) {
        seen.add(offset);
        positions.push(offset);
      }
    }
    positions.sort((a, b) => a - b);
    const ranges = [];
    let runStart = -1;
    let runEnd = -1;
    positions.forEach(pos => {
      if (runStart === -1) {
        runStart = pos;
        runEnd = pos;
      } else if (pos === runEnd + 1) {
        runEnd = pos;
      } else {
        map.segments.forEach(segment => {
          if (runEnd < segment.start || runStart >= segment.end) return;
          const localStart = Math.max(runStart, segment.start) - segment.start;
          const localEnd = Math.min(runEnd + 1, segment.end) - segment.start;
          if (localEnd > localStart) {
            const range = document.createRange();
            range.setStart(segment.node, localStart);
            range.setEnd(segment.node, localEnd);
            ranges.push(range);
          }
        });
        runStart = pos;
        runEnd = pos;
      }
    });
    if (runStart !== -1) {
      map.segments.forEach(segment => {
        if (runEnd < segment.start || runStart >= segment.end) return;
        const localStart = Math.max(runStart, segment.start) - segment.start;
        const localEnd = Math.min(runEnd + 1, segment.end) - segment.start;
        if (localEnd > localStart) {
          const range = document.createRange();
          range.setStart(segment.node, localStart);
          range.setEnd(segment.node, localEnd);
          ranges.push(range);
        }
      });
    }
    return ranges;
  };

  this.clearWordHighlight = () => {
    if (typeof CSS === 'undefined' || !CSS.highlights) return;
    try {
      CSS.highlights.delete('tts-word');
    } catch (error) {
      // Custom Highlight API unsupported – degrade gracefully.
    }
  };

  // Applies the spoken-word highlight rendered only via the Custom Highlight
  // API, so no DOM mutations are ever performed while narrating.
  this.setWordRange = (paragraphId, start, end) => {
    if (!this.highlightEnabled) {
      this.clearWordHighlight();
      return;
    }
    if (
      typeof CSS === 'undefined' ||
      !CSS.highlights ||
      typeof Highlight === 'undefined'
    ) {
      return;
    }
    if (!this.wordMap || this.wordMap.paragraphId !== paragraphId) return;
    const ranges = this.rangesFor(this.wordMap, start, end);
    try {
      if (ranges.length === 0) {
        this.clearWordHighlight();
        return;
      }
      const highlight = CSS.highlights.get('tts-word') || new Highlight();
      highlight.clear();
      ranges.forEach(range => highlight.add(range));
      CSS.highlights.set('tts-word', highlight);
    } catch (error) {
      // Custom Highlight API unsupported – degrade gracefully.
    }
  };

  this.setHighlightSettings = settings => {
    this.highlightEnabled = settings.enabled !== false;
    this.highlightColor = settings.color || '';
    const fallback =
      'color-mix(in srgb, var(--readerSettings-textColor) 20%, var(--readerSettings-theme))';
    document.documentElement.style.setProperty(
      '--tts-highlight-color',
      this.highlightColor || fallback,
    );
    if (!this.highlightEnabled) {
      this.clearWordHighlight();
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

window.pageReader = new (function () {
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
    this.chapterEnding.style.transition = 'unset';
    if (bool) {
      this.chapterEnding.style.transform = `translateX(${left ? -200 : 0}vw)`;
      requestAnimationFrame(() => {
        if (!instant) {
          this.chapterEnding.style.transition = 'transform 200ms';
        }
        this.chapterEnding.style.transform = 'translateX(-100vw)';
      });
      this.chapterEndingVisible.val = true;
    } else {
      if (!instant) {
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
    if (destPage < 0) {
      if (!reader.prevChapter) return;
      document.getElementsByClassName('transition-chapter')[0].innerText =
        reader.prevChapter.name;
      this.showChapterEnding(true, false, true);
      this.chapterNavigationPending = true;
      setTimeout(() => {
        reader.post({ type: 'prev' });
      }, 200);
      return;
    }
    if (destPage >= this.totalPages.val) {
      if (!reader.nextChapter) return;
      document.getElementsByClassName('transition-chapter')[0].innerText =
        reader.nextChapter.name;
      this.showChapterEnding(true);
      this.chapterNavigationPending = true;
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

    if (save && newProgress > reader.chapter.progress) {
      reader.chapter.progress = newProgress;
      reader.post({
        type: 'save',
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
        (window.scrollY + reader.layoutHeight) / reader.chapterHeight,
      );
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
})();

document.addEventListener('DOMContentLoaded', () => {
  if (pageReader.chapterEndingVisible.val) {
    pageReader.showChapterEnding(true, true);
  }
});

/** Scroll offset the reading position was restored to, in scroll mode. */
let restoredScrollTop = null;
let positionRestored = false;

function calculatePages(behavior = 'instant') {
  reader.refresh();

  if (reader.generalSettings.val.pageReader) {
    pageReader.repaginate(reader.chapter.progress / 100);
  } else {
    restoredScrollTop =
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
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        pageReader.ignoreClickUntil = Date.now() + 400;
      }
      reader.chapterElement.style.transition = 'transform 200ms';
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
  });
})();

// text options
(function () {
  // What the chapter element currently holds. The document is delivered with
  // the untransformed chapter already parsed, so writing the same markup back
  // would re-parse and re-layout the whole chapter (and restart image loads)
  // for nothing - which is exactly what happens when neither transform is on.
  let appliedHTML = reader.rawHTML;

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
        .replace(
          /<br>(?:(?=\s*<\/?p[> ])|(?<=<\/?p(?:>| [^>]+>)(?:<[^>]+>)*\s*<br>))\s*/g,
          '',
        );
    }
    if (html === appliedHTML) {
      return;
    }

    reader.chapterElement.innerHTML = html;
    appliedHTML = html;
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
