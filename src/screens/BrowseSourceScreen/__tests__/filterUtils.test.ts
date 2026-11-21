import {
  MAX_SUGGESTIONS_HEIGHT,
  getEstimatedSuggestionsHeight,
  getSuggestionPlacement,
} from '../components/filterUtils';

const screen = { height: 800, width: 400 };
const noInsets = { bottom: 0, left: 0, right: 0, top: 0 };
const insets = { bottom: 48, left: 0, right: 0, top: 24 };
const anchor = { height: 56, width: 352, x: 24, y: 200 };

describe('getSuggestionPlacement', () => {
  it('opens below the field when there is room', () => {
    expect(
      getSuggestionPlacement({
        anchor,
        contentHeight: 162,
        insets,
        screen,
      }),
    ).toEqual({ left: 24, maxHeight: 162, top: 260, width: 352 });
  });

  it('flips above the field when the space below cannot hold the list', () => {
    expect(
      getSuggestionPlacement({
        anchor: { ...anchor, y: 580 },
        contentHeight: 162,
        insets,
        screen,
      }),
    ).toEqual({ left: 24, maxHeight: 162, top: 414, width: 352 });
  });

  it('stays below when both sides are tight but below has more room', () => {
    expect(
      getSuggestionPlacement({
        anchor: { ...anchor, y: 108 },
        contentHeight: 162,
        insets: { ...insets, bottom: 0 },
        screen: { height: 300, width: 400 },
      }),
    ).toEqual({ left: 24, maxHeight: 124, top: 168, width: 352 });
  });

  it('clamps the list height to the space above when flipping', () => {
    expect(
      getSuggestionPlacement({
        anchor: { ...anchor, y: 250 },
        contentHeight: 240,
        insets: { ...insets, bottom: 0 },
        screen: { height: 300, width: 400 },
      }),
    ).toEqual({ left: 24, maxHeight: 214, top: 32, width: 352 });
  });

  it('clamps a field that runs past the horizontal margin', () => {
    expect(
      getSuggestionPlacement({
        anchor: { height: 56, width: 200, x: 350, y: 200 },
        contentHeight: 162,
        insets,
        screen,
      }),
    ).toEqual({ left: 184, maxHeight: 162, top: 260, width: 200 });
  });

  it('shrinks a field wider than the usable screen', () => {
    expect(
      getSuggestionPlacement({
        anchor: { height: 56, width: 900, x: 0, y: 200 },
        contentHeight: 162,
        insets: { ...noInsets, right: 48 },
        screen: { height: 800, width: 800 },
      }),
    ).toEqual({ left: 16, maxHeight: 162, top: 260, width: 720 });
  });

  it('caps a long list at the maximum height', () => {
    expect(
      getSuggestionPlacement({
        anchor,
        contentHeight: 500,
        insets,
        screen,
      }),
    ).toEqual({
      left: 24,
      maxHeight: MAX_SUGGESTIONS_HEIGHT,
      top: 260,
      width: 352,
    });
  });

  it('respects the top inset when clamping above', () => {
    expect(
      getSuggestionPlacement({
        anchor: { ...anchor, y: 90 },
        contentHeight: 160,
        insets,
        screen: { height: 200, width: 400 },
      }),
    ).toEqual({ left: 24, maxHeight: 54, top: 32, width: 352 });
  });
});

describe('getEstimatedSuggestionsHeight', () => {
  it('scales with the number of rows', () => {
    expect(getEstimatedSuggestionsHeight(1)).toBe(42);
    expect(getEstimatedSuggestionsHeight(3)).toBe(122);
  });

  it('caps at the maximum height', () => {
    expect(getEstimatedSuggestionsHeight(6)).toBe(MAX_SUGGESTIONS_HEIGHT);
  });
});
