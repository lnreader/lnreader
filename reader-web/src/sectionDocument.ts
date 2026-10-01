import {
  interaction,
  listenForSwipes,
  onDocumentClick,
  onKeyDown,
  onSelectionChange,
} from './input';
import { keepWholeSpreads } from './layout';
import { runPluginScript } from './snippets';
import { log, type ReaderState } from './state';

// Wires up each chapter document as the paginator loads it.
export const onSectionLoad = (
  state: ReaderState,
  { doc, index }: { doc: Document; index: number },
) => {
  const warn = (message: string) => log(state, 'warn', message);
  doc.addEventListener('click', event => onDocumentClick(state, event, doc));
  doc.addEventListener('selectionchange', () => onSelectionChange(state, doc));
  doc.addEventListener('keydown', event => onKeyDown(state, event));
  doc.addEventListener('touchstart', () => interaction(state), {
    passive: true,
  });
  listenForSwipes(state, doc);
  keepWholeSpreads(state, doc);
  doc.addEventListener('contextmenu', event => {
    const target = event.target as Element | null;
    if (target instanceof doc.defaultView!.HTMLImageElement) {
      event.preventDefault();
      state.images.open(target.currentSrc || target.src);
    }
  });
  runPluginScript(state.config?.pluginJs ?? '', doc, warn);
  const section = state.book?.chapters[index];
  if (section && state.snippets) {
    state.snippets(doc, {
      novelName: state.config?.novelName ?? '',
      chapterName: section.name,
      sourceId: state.config?.pluginId ?? '',
      chapterId: section.id,
      novelId: state.config?.novelId ?? 0,
    });
  }
};
