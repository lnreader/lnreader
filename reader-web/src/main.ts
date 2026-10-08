import type {
  NativeToWebMessage,
  ReaderOpenMessage,
} from '../../src/screens/reader/engine/protocol';
import { setAutoScroll } from './autoscroll';
import { createBook } from './book';
import { createBridge } from './bridge';
import { createImageViewer } from './images';
import { onKeyDown, tap } from './input';
import {
  applyBackground,
  applyLayout,
  createPaginator,
  setPreferences,
} from './layout';
import { goTo, turn, updateMarginals } from './position';
import { createSearch, runSearch, showSearch } from './search';
import {
  editText,
  loadSection,
  reloadSection,
  settleSection,
} from './sections';
import { compileSnippets } from './snippets';
import {
  createSpeech,
  highlightSpeech,
  markSpeechTarget,
  startSpeech,
  startSpeechAt,
} from './speech';
import { log, type ReaderState } from './state';

const open = async (state: ReaderState, config: ReaderOpenMessage) => {
  state.config = config;
  state.prefs = config.preferences;
  state.battery = config.battery;
  state.snippets = compileSnippets(config.customJs, message =>
    log(state, 'warn', message),
  );
  state.book = createBook(section => loadSection(state, section), config.dir);
  state.book.append(config.sections);
  applyBackground(state);
  createPaginator(state);
  await goTo(state, config.start);
  state.clock ??= setInterval(() => updateMarginals(state), 30_000);
};

const handle = (state: ReaderState, message: NativeToWebMessage) => {
  switch (message.type) {
    case 'open':
      void open(state, message);
      break;
    case 'append-sections':
      state.book?.append(message.sections);
      break;
    case 'section-content':
      settleSection(state, message.requestId, {
        html: message.html,
        baseUrl: message.baseUrl,
      });
      break;
    case 'section-error':
      settleSection(state, message.requestId, new Error(message.message));
      break;
    case 'preferences':
      setPreferences(state, message.preferences);
      break;
    case 'go-to':
      void goTo(state, message.location);
      break;
    case 'turn':
      void turn(state, message.direction, message.distance);
      break;
    case 'auto-scroll':
      setAutoScroll(
        state,
        message.interval,
        message.distance,
        message.smooth ?? false,
      );
      break;
    case 'search':
      runSearch(state, message.query);
      break;
    case 'search-step':
      showSearch(state, state.search.step(message.direction));
      break;
    case 'search-clear':
      state.search.clear();
      break;
    case 'tts-start':
      startSpeech(state);
      break;
    case 'tts-highlight':
      highlightSpeech(state, message.index);
      break;
    case 'tts-stop':
      state.speech.stop();
      break;
    case 'tts-target':
      markSpeechTarget(state, message.x, message.y);
      break;
    case 'tts-target-clear':
      markSpeechTarget(state);
      break;
    case 'tts-start-at':
      startSpeechAt(state, message.x, message.y);
      break;
    case 'battery':
      state.battery = message.level;
      updateMarginals(state);
      break;
    case 'reload-section':
      void reloadSection(state, message.chapterId);
      break;
    case 'text-edit':
      editText(state, message.text, message.replacement ?? '');
      break;
    case 'clear-selection':
      for (const { doc } of state.paginator?.getContents() ?? []) {
        doc.getSelection()?.removeAllRanges();
      }
      break;
  }
};

const root = document.getElementById('reader');
const status = document.getElementById('ln-status');

if (root && status) {
  const bridge = createBridge();
  const state: ReaderState = {
    root,
    status,
    bridge,
    battery: -1,
    requests: new Map(),
    nextRequestId: 1,
    search: createSearch(),
    speech: createSpeech(),
    images: createImageViewer(document),
    lastInteraction: 0,
    hasSelection: false,
    appliedStyles: '',
    holdRelocation: false,
    respread: 0,
  };
  window.addEventListener('resize', () => applyLayout(state));
  document.addEventListener('keydown', event => onKeyDown(state, event));
  root.addEventListener('click', event => {
    if (event.target === root || event.target === state.paginator) {
      tap(state, event.clientX, event.clientY);
    }
  });
  window.lnReader = { receive: message => handle(state, message) };
  window.addEventListener('error', event =>
    bridge.send({ type: 'error', message: String(event.message) }),
  );
  window.addEventListener('unhandledrejection', event =>
    bridge.send({ type: 'error', message: String(event.reason) }),
  );
  bridge.send({ type: 'ready' });
}
