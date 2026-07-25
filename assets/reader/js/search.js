window.readerSearch = new (function () {
  const MIN_QUERY_LENGTH = 3;
  const SEGMENT_BATCH_SIZE = 40;
  const MAX_RENDERED_MATCHES = 1500;
  const SPECIAL_CHARACTER_REGEX = /[^\p{L}\p{N}\s]/u;
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
  this.cachedSegments = null;
  this.lastSegmentedChapterId = null;
  this.isValidState = true;

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
      if (typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(this.pendingSearchTimer);
      }
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
    const marks = document.querySelectorAll('mark.lnreader-search-match');
    const fragment = document.createDocumentFragment();

    marks.forEach(mark => {
      const parent = mark.parentNode;
      if (!parent) {
        return;
      }

      while (mark.firstChild) {
        fragment.appendChild(mark.firstChild);
      }
      parent.replaceChild(fragment, mark);
      touchedParents.add(parent);
    });

    touchedParents.forEach(parent => {
      parent.normalize();
    });

    this.matches = [];
    this.index = -1;
    this.total = 0;
    this.isTruncated = false;
    this.isValidState = true;
    this.cachedSegments = null;
    this.refreshLayout();
  };

  this.clear = (emit = true, resetQuery = true) => {
    this.cancelPendingSearch();

    if (resetQuery) {
      this.query = '';
    }

    this.resetMatches();
    this.invalidateCache();

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
    let current = previousNode.nextSibling;
    while (current && current !== nextNode) {
      if (current.nodeType === Node.ELEMENT_NODE && current.matches(selector)) {
        return true;
      }
      if (current.querySelector?.(selector)) {
        return true;
      }
      current = current.nextSibling;
    }
    return false;
  };

  this.buildTextSegments = () => {
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

  this.getTextSegments = () => {
    if (this.cachedSegments) {
      return this.cachedSegments;
    }
    this.cachedSegments = this.buildTextSegments();
    return this.cachedSegments;
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

  this.ensureSearch = query => {
    const term = String(query ?? this.query ?? '').trim();
    if (!term) {
      this.clear();
      return false;
    }

    if (term !== this.query || !this.isValidState) {
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

    requestAnimationFrame(() => {
      match.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  this.focus = index => {
    if (!this.matches.length) {
      this.index = -1;
      this.emit();
      return;
    }

    const oldIndex = this.index;
    this.index =
      ((index % this.matches.length) + this.matches.length) %
      this.matches.length;

    if (oldIndex !== this.index) {
      if (oldIndex >= 0) {
        this.matches[oldIndex]?.classList.remove('lnreader-search-match-active');
      }
      this.matches[this.index].classList.add('lnreader-search-match-active');
      this.scrollToMatch(this.matches[this.index]);
    }

    this.emit();
  };

  this.finishSearch = (query, preferredIndex, total) => {
    this.pendingSearchTimer = null;
    this.matches = Array.from(
      reader.chapterElement.querySelectorAll('mark.lnreader-search-match'),
    );
    this.total = total;
    this.isTruncated = this.matches.length < this.total;
    this.isValidState = true;
    this.refreshLayout();

    if (!this.matches.length) {
      this.emit(query);
      return;
    }

    this.focus(Math.max(0, Math.min(preferredIndex, this.matches.length - 1)));
  };

  this.invalidateCache = () => {
    this.cachedSegments = null;
    this.isValidState = false;
  };

  this.search = (query, preferredIndex = 0) => {
    const term = String(query ?? '').trim();
    this.cancelPendingSearch();
    this.resetMatches();
    this.query = term;

    if (
      !term ||
      (term.length < MIN_QUERY_LENGTH && !SPECIAL_CHARACTER_REGEX.test(term))
    ) {
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
        if (typeof requestIdleCallback !== 'undefined') {
          this.pendingSearchTimer = requestIdleCallback(processBatch, {
            timeout: 50,
          });
        } else {
          this.pendingSearchTimer = setTimeout(processBatch, 0);
        }
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
