interface HighlightRealm {
  Highlight?: new (...ranges: Range[]) => object;
  CSS?: { highlights?: Map<string, object> };
}

// Each section iframe has its own highlight registry.
export const setHighlight = (
  doc: Document,
  name: string,
  ranges: readonly Range[],
) => {
  const realm = doc.defaultView as (Window & HighlightRealm) | null;
  const registry = realm?.CSS?.highlights;
  const HighlightClass = realm?.Highlight;
  if (!registry || !HighlightClass) {
    return;
  }
  if (ranges.length) {
    registry.set(name, new HighlightClass(...ranges));
  } else {
    registry.delete(name);
  }
};

export const endsAfter = (range: Range, from: Range | undefined) => {
  if (
    !from ||
    range.startContainer.ownerDocument !== from.startContainer.ownerDocument
  ) {
    return true;
  }
  try {
    return from.comparePoint(range.endContainer, range.endOffset) >= 0;
  } catch {
    return true;
  }
};

export const inReaderUi = (range: Range) => {
  const node = range.startContainer;
  const element = node instanceof Element ? node : node.parentElement;
  return !!element?.closest('.ln-chapter-end');
};
