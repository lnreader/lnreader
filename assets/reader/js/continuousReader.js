/**
 * Continuous reading: keeps a window of consecutive chapters in the document
 * and asks the app for the next (or previous) one as the reader approaches
 * either end, so a novel is read by scrolling instead of by pressing "next
 * chapter" at every boundary.
 *
 * The app owns chapter resolution and text loading; this file owns the DOM: it
 * inserts chapters, keeps the reading position stable while doing so, drops the
 * ones that have scrolled far out of the way, and reports which chapter is
 * currently on screen.
 */
window.continuousReader = new (function () {
  /** How close to the end (in screens) the reader gets before loading. */
  const LOAD_AHEAD_SCREENS = 2;
  /**
   * The same for the start of the stream. Kept shorter: reading runs forwards,
   * so what is behind is only there for going back over a boundary.
   */
  const LOAD_BEHIND_SCREENS = 1;
  /** Chapters kept in the document at once. Older ones are dropped. */
  const MAX_SECTIONS = 5;
  /** How long a freshly prepended chapter is watched for late layout growth. */
  const GROWTH_WATCH_MS = 20000;

  this.enabled = reader.continuousReading;
  /** Loaded chapters, in reading order. */
  this.sections = [];
  this.activeId = reader.chapter.id;
  this.pending = { NEXT: false, PREV: false };
  this.edgeReached = { NEXT: false, PREV: false };
  this.statusText = van.state('');
  let started = false;

  const activeSection = () =>
    this.sections.find(section => section.chapter.id === this.activeId) ??
    this.sections[0];

  const sectionRect = section => section.element.getBoundingClientRect();

  const createSection = chapter => {
    const element = document.createElement('div');
    element.className = 'chapter-section';
    element.dataset.chapterId = chapter.id;

    const header = document.createElement('div');
    header.className = 'chapter-section-header';
    header.textContent = chapter.name;

    const body = document.createElement('div');
    body.className = 'chapter-section-body';

    element.appendChild(header);
    element.appendChild(body);

    return { chapter, element, body, growthObserver: null };
  };

  /**
   * Keeps the reading position put while a chapter inserted above it is still
   * settling - images and fonts land after the insert and would otherwise push
   * the text the reader is looking at down the screen.
   */
  const watchGrowth = section => {
    let lastHeight = section.element.offsetHeight;
    const observer = new ResizeObserver(() => {
      const height = section.element.offsetHeight;
      const delta = height - lastHeight;
      lastHeight = height;
      // Only compensate while the whole section sits above the viewport: once
      // the reader has scrolled into it, growth below the fold is harmless.
      if (delta && sectionRect(section).bottom <= 0) {
        window.scrollBy({ top: delta, behavior: 'instant' });
      }
    });
    observer.observe(section.element);
    section.growthObserver = observer;
    setTimeout(() => {
      observer.disconnect();
      section.growthObserver = null;
    }, GROWTH_WATCH_MS);
  };

  const postBounds = () => {
    if (!this.sections.length) {
      return;
    }
    reader.post({
      type: 'inline-bounds',
      data: {
        headChapterId: this.sections[0].chapter.id,
        tailChapterId: this.sections[this.sections.length - 1].chapter.id,
      },
    });
  };

  const dropSection = (section, fromStart) => {
    const height = section.element.offsetHeight;
    section.growthObserver?.disconnect();
    section.growthObserver = null;
    readerContent.removeSection(section.body);
    section.element.remove();
    if (fromStart) {
      this.sections.shift();
      // Content above the viewport went away, so everything below it moved up.
      window.scrollBy({ top: -height, behavior: 'instant' });
      this.edgeReached.PREV = false;
    } else {
      this.sections.pop();
      this.edgeReached.NEXT = false;
    }
  };

  /**
   * Drops chapters beyond the window, from the end the reader is moving away
   * from - dropping the one just inserted would only have it asked for again.
   * A chapter still in view (or being read) is kept whatever the count.
   */
  const trim = grewTowards => {
    const fromStart = grewTowards === 'NEXT';
    while (this.sections.length > MAX_SECTIONS) {
      const section = fromStart
        ? this.sections[0]
        : this.sections[this.sections.length - 1];

      const rect = sectionRect(section);
      const outOfSight = rect.bottom <= 0 || rect.top >= reader.layoutHeight;
      if (section.chapter.id === this.activeId || !outOfSight) {
        return;
      }
      dropSection(section, fromStart);
    }
  };

  const setActive = section => {
    const previous = activeSection();
    const movedForward =
      this.sections.indexOf(section) > this.sections.indexOf(previous);

    this.activeId = section.chapter.id;
    reader.chapter = section.chapter;

    // A chapter that was scrolled past in full has been read.
    if (previous && movedForward) {
      reader.post({ type: 'save', data: 100, chapterId: previous.chapter.id });
    }
    reader.post({
      type: 'chapter-changed',
      data: { chapterId: section.chapter.id },
    });
  };

  const requestChapter = direction => {
    if (this.pending[direction] || this.edgeReached[direction]) {
      return;
    }
    this.pending[direction] = true;
    if (direction === 'NEXT') {
      this.statusText.val = reader.strings.loadingNextChapter;
    }
    reader.post({ type: 'load-inline', data: { direction } });
  };

  const update = () => {
    // Before the saved reading position is restored the reader sits at the top
    // of the document, which is no reason to go looking for what precedes it.
    if (!started || !this.sections.length) {
      return;
    }

    // The chapter that owns the middle of the screen is the one being read.
    let active = this.sections[0];
    for (const section of this.sections) {
      if (sectionRect(section).top > reader.layoutHeight / 2) {
        break;
      }
      active = section;
    }
    if (active.chapter.id !== this.activeId) {
      setActive(active);
    }

    if (
      window.scrollY + reader.layoutHeight * (1 + LOAD_AHEAD_SCREENS) >=
      document.documentElement.scrollHeight
    ) {
      requestChapter('NEXT');
    }
    if (window.scrollY <= reader.layoutHeight * LOAD_BEHIND_SCREENS) {
      requestChapter('PREV');
    }
  };

  /** Called by the app once it has the markup for an adjacent chapter. */
  this.insertChapter = ({ direction, chapter, html }) => {
    if (!this.enabled) {
      return;
    }
    this.pending[direction] = false;
    this.statusText.val = '';
    if (this.sections.some(section => section.chapter.id === chapter.id)) {
      return;
    }

    const section = createSection(chapter);
    if (direction === 'NEXT') {
      reader.chapterElement.appendChild(section.element);
      readerContent.addSection(section.body, html);
      this.sections.push(section);
    } else {
      const previousHeight = document.documentElement.scrollHeight;
      const previousScrollY = window.scrollY;
      reader.chapterElement.insertBefore(
        section.element,
        reader.chapterElement.firstChild,
      );
      readerContent.addSection(section.body, html);
      this.sections.unshift(section);

      const delta = document.documentElement.scrollHeight - previousHeight;
      if (delta) {
        window.scrollTo({ top: previousScrollY + delta, behavior: 'instant' });
      }
      watchGrowth(section);
    }

    // The saved progress described a document holding a single chapter.
    window.releaseReadingPosition();
    window.readerSearch?.invalidateCache();
    reader.refresh();
    trim(direction);
    postBounds();
    update();
  };

  /** Called by the app when there is nothing left in that direction. */
  this.setEdgeReached = direction => {
    this.pending[direction] = false;
    this.edgeReached[direction] = true;
    if (direction === 'NEXT') {
      this.statusText.val = reader.strings.noNextChapter;
    }
  };

  /** Called by the app when a load failed, so it can be retried. */
  this.cancelPending = direction => {
    this.pending[direction] = false;
    if (direction === 'NEXT') {
      this.statusText.val = '';
    }
  };

  /** How far the chapter on screen has been read, as a 0-1 ratio. */
  this.activeRatio = () => {
    const section = activeSection();
    if (!section) {
      return 0;
    }
    const rect = sectionRect(section);
    if (rect.height <= 0) {
      return 0;
    }
    return Math.min(
      1,
      Math.max(0, (reader.layoutHeight - rect.top) / rect.height),
    );
  };

  /** Seeks within the chapter on screen, for the seekbar. */
  this.scrollToRatio = ratio => {
    const section = activeSection();
    if (!section) {
      return;
    }
    const rect = sectionRect(section);
    const sectionTop = rect.top + window.scrollY;
    window.scrollTo({
      top: sectionTop + rect.height * ratio - reader.layoutHeight,
      behavior: 'instant',
    });
  };

  this.saveProgress = () => {
    const section = activeSection();
    if (!section) {
      return;
    }
    reader.post({
      type: 'save',
      data: parseInt(this.activeRatio() * 100, 10),
      chapterId: section.chapter.id,
    });
  };

  /**
   * Starts streaming. Called once the reading position has been restored, so
   * the first look at where the reader is is taken at the right place.
   */
  this.start = () => {
    if (!this.enabled || started) {
      return;
    }
    started = true;
    update();
  };

  if (this.enabled) {
    // The chapter the document was built with becomes the first section. Its
    // nodes are moved rather than re-parsed so images already in flight are not
    // requested a second time.
    const first = createSection(reader.chapter);
    while (reader.chapterElement.firstChild) {
      first.body.appendChild(reader.chapterElement.firstChild);
    }
    reader.chapterElement.appendChild(first.element);
    this.sections.push(first);
    readerContent.addSection(first.body, reader.rawHTML, true);

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
          update();
        });
      },
      { passive: true },
    );
  }
})();
