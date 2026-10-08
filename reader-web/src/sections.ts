import type { ReaderSection } from '../../src/screens/reader/engine/protocol';
import {
  buildChapterDocument,
  buildErrorDocument,
  type ChapterContent,
} from './content';
import { createPaginator } from './layout';
import { goTo } from './position';
import { currentLocation, type ReaderState } from './state';

const chapterEnding = (state: ReaderState, section: ReaderSection) => {
  const strings = state.config?.strings;
  if (!strings) {
    return undefined;
  }
  const chapters = state.book?.chapters ?? [];
  const next = chapters[chapters.findIndex(item => item.id === section.id) + 1];
  return {
    finished: `${strings.finished}: ${section.name.trim()}`,
    next: next && strings.nextChapter.replace('%{name}', next.name),
    noNext: strings.noNextChapter,
  };
};

// The app answers each request with the chapter's HTML (or an error).
export const loadSection = (
  state: ReaderState,
  section: ReaderSection,
): Promise<string> => {
  const requestId = state.nextRequestId++;
  const content = new Promise<ChapterContent>((resolve, reject) => {
    state.requests.set(requestId, { resolve, reject });
  });
  state.bridge.send({
    type: 'request-section',
    requestId,
    chapterId: section.id,
  });
  const { prefs, config } = state;
  return content.then(
    ({ html, baseUrl }) => {
      state.book?.setFailed(section.id, false, 1);
      return buildChapterDocument(
        { html, baseUrl },
        {
          title: section.name,
          showTitle: prefs?.showChapterTitle ?? false,
          ending: chapterEnding(state, section),
          bionic: prefs?.bionicReading ?? false,
          dir: config?.dir ?? 'ltr',
          lang: config?.lang,
          sourceId: config?.pluginId,
        },
      );
    },
    (error: Error) => {
      const book = state.book;
      if (book) {
        // Stop on the far side of the error from where the reader is.
        const here = currentLocation(state)?.chapterId;
        const failedAt = book.indexOf(section.id);
        const readingAt = here === undefined ? failedAt : book.indexOf(here);
        book.setFailed(section.id, true, failedAt < readingAt ? -1 : 1);
      }
      return buildErrorDocument(
        section.name,
        error.message,
        config?.strings.retry ?? 'Retry',
      );
    },
  );
};

export const settleSection = (
  state: ReaderState,
  requestId: number,
  result: ChapterContent | Error,
) => {
  const request = state.requests.get(requestId);
  state.requests.delete(requestId);
  if (result instanceof Error) {
    request?.reject(result);
  } else {
    request?.resolve(result);
  }
};

export const reloadSection = async (state: ReaderState, chapterId: number) => {
  state.book?.invalidate(chapterId);
  if ((state.book?.indexOf(chapterId) ?? -1) === -1) {
    return;
  }
  const location = currentLocation(state);
  // The new paginator renders blank until the section loads: keep the old one
  // over it until then, or every pull-to-refresh flashes the page.
  const previous = state.paginator;
  state.paginator = undefined;
  if (previous) {
    Object.assign(previous.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '1',
      pointerEvents: 'none',
    });
  }
  createPaginator(state);
  try {
    await goTo(
      state,
      location?.chapterId === chapterId ? location : { chapterId, fraction: 0 },
    );
  } finally {
    previous?.destroy();
    previous?.remove();
  }
};

export const editText = (
  state: ReaderState,
  text: string,
  replacement: string,
) => {
  if (!text) {
    return;
  }
  for (const { doc } of state.paginator?.getContents() ?? []) {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue?.includes(text)) {
        nodes.push(node as Text);
      }
    }
    for (const node of nodes) {
      node.nodeValue = (node.nodeValue ?? '').split(text).join(replacement);
    }
    doc.getSelection()?.removeAllRanges();
  }
  // Later loads get the edit from the app's saved rules.
  state.book?.invalidate();
};
