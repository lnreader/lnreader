import { getSentences } from 'foliate-js/tts.js';
import { textWalker } from 'foliate-js/text-walker.js';

import { HIGHLIGHTS } from '../../src/screens/reader/engine/styles';
import { CHAPTER_ELEMENT_ID } from './content';
import { endsAfter, inReaderUi, setHighlight } from './highlights';
import { anchorTo } from './position';
import { currentChapter, primaryDocument, type ReaderState } from './state';

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

// The app speaks the sentences natively and reports which one is playing.
export const createSpeech = () => {
  let doc: Document | undefined;
  let ranges: Range[] = [];

  const stop = () => {
    if (doc) {
      setHighlight(doc, HIGHLIGHTS.tts, []);
    }
    doc = undefined;
    ranges = [];
  };

  return {
    stop,
    build: (target: Document, from?: Range): string[] => {
      stop();
      doc = target;
      const utterances: string[] = [];
      for (const { range } of getSentences(target, textWalker)) {
        const text = clean(range.toString());
        if (text && endsAfter(range, from) && !inReaderUi(range)) {
          ranges.push(range);
          utterances.push(text);
        }
      }
      return utterances;
    },
    highlight: (index: number): Range | undefined => {
      const range = ranges[index];
      if (doc) {
        setHighlight(doc, HIGHLIGHTS.tts, range ? [range] : []);
      }
      return range;
    },
  };
};

// Readable means inline-only content: containers, and so the gaps around
// paragraphs or between the pages of a spread, don't count.
const READABLE_NODE_NAMES = [
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

const readable = (element: Element) => {
  if (
    element.nodeName !== 'SPAN' &&
    READABLE_NODE_NAMES.includes(element.nodeName)
  ) {
    return false;
  }
  if (!element.hasChildNodes()) {
    return false;
  }
  return [...element.childNodes].every(child =>
    READABLE_NODE_NAMES.includes(child.nodeName),
  );
};

const paragraphAt = (state: ReaderState, x: number, y: number) => {
  for (const { doc, index } of state.paginator?.getContents() ?? []) {
    const frame = doc.defaultView?.frameElement?.getBoundingClientRect();
    if (
      !frame ||
      x < frame.left ||
      x > frame.right ||
      y < frame.top ||
      y > frame.bottom
    ) {
      continue;
    }
    const block = doc
      .elementsFromPoint(x - frame.left, y - frame.top)
      .find(
        element =>
          element.closest(`#${CHAPTER_ELEMENT_ID}`) &&
          !element.closest('.ln-chapter-end') &&
          readable(element),
      );
    if (block) {
      return { doc, index, block };
    }
  }
  return undefined;
};

export const startSpeech = (state: ReaderState) => {
  const doc = primaryDocument(state);
  const chapter = currentChapter(state);
  if (!doc || !chapter) {
    return;
  }
  const utterances = state.speech.build(doc, state.location?.range);
  state.bridge.send({ type: 'tts-queue', chapterId: chapter.id, utterances });
};

export const markSpeechTarget = (
  state: ReaderState,
  x?: number,
  y?: number,
) => {
  const target =
    x === undefined || y === undefined ? undefined : paragraphAt(state, x, y);
  for (const { doc } of state.paginator?.getContents() ?? []) {
    const ranges: Range[] = [];
    if (target?.doc === doc) {
      const range = doc.createRange();
      range.selectNodeContents(target.block);
      ranges.push(range);
    }
    setHighlight(doc, HIGHLIGHTS.ttsTarget, ranges);
  }
};

export const startSpeechAt = (state: ReaderState, x: number, y: number) => {
  const target = paragraphAt(state, x, y);
  markSpeechTarget(state);
  const chapter = target && state.book?.chapters[target.index];
  if (!target || !chapter) {
    return;
  }
  const from = target.doc.createRange();
  from.setStart(target.block, 0);
  const utterances = state.speech.build(target.doc, from);
  state.bridge.send({ type: 'tts-queue', chapterId: chapter.id, utterances });
};

export const highlightSpeech = (state: ReaderState, index: number) => {
  const range = state.speech.highlight(index);
  const visible = state.location?.range;
  if (!range) {
    return;
  }
  let onScreen = false;
  try {
    onScreen =
      !!visible &&
      visible.startContainer.ownerDocument ===
        range.startContainer.ownerDocument &&
      visible.comparePoint(range.startContainer, range.startOffset) === 0 &&
      visible.comparePoint(range.endContainer, range.endOffset) === 0;
  } catch {
    onScreen = false;
  }
  if (!onScreen && state.paginator) {
    void anchorTo(state, state.paginator, range);
  }
};
