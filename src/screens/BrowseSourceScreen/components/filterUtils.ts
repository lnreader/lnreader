import type { LayoutRectangle } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import {
  FilterToValues,
  FilterTypes,
  Filters,
  isFilterValue,
  ValueOfFilter,
} from '@plugins/types/filterTypes';

export const getValueFor = <T extends FilterTypes>(
  filter: Filters[string],
  value: FilterToValues<Filters>[string],
): ValueOfFilter<T> =>
  (isFilterValue(value, filter.type)
    ? value.value
    : filter.value) as ValueOfFilter<T>;

export const addMultiTextValues = (
  current: readonly string[],
  rawValues: readonly string[],
): string[] => {
  const next = [...current];
  rawValues.forEach(rawValue => {
    const value = rawValue.trim();
    if (value && !next.includes(value)) {
      next.push(value);
    }
  });
  return next;
};

const HORIZONTAL_MARGIN = 16;
const VERTICAL_MARGIN = 8;
const ANCHOR_GAP = 4;

// Rows are single-line, so their height only varies with font scaling. The
// estimate decides whether to flip above the field and how far the list can
// grow; the inner ScrollView absorbs any error.
export const SUGGESTION_ITEM_HEIGHT = 40;
export const MAX_SUGGESTIONS_HEIGHT = 240;

export const getEstimatedSuggestionsHeight = (count: number) =>
  Math.min(count * SUGGESTION_ITEM_HEIGHT + 2, MAX_SUGGESTIONS_HEIGHT);

interface SuggestionPlacementInput {
  anchor: LayoutRectangle;
  contentHeight: number;
  insets: EdgeInsets;
  screen: { height: number; width: number };
}

export interface SuggestionPlacement {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
}

// The list is portaled to the window, so it is positioned in window
// coordinates: keep it inside the safe area and flip it above the field when
// the space below cannot hold it.
export const getSuggestionPlacement = ({
  anchor,
  contentHeight,
  insets,
  screen,
}: SuggestionPlacementInput): SuggestionPlacement => {
  const minLeft = insets.left + HORIZONTAL_MARGIN;
  const maxRight = screen.width - insets.right - HORIZONTAL_MARGIN;
  const minTop = insets.top + VERTICAL_MARGIN;
  const maxBottom = screen.height - insets.bottom - VERTICAL_MARGIN;

  // A field wider than the usable area (landscape + insets) is clamped.
  const width = Math.max(0, Math.min(anchor.width, maxRight - minLeft));
  const left = Math.max(minLeft, Math.min(anchor.x, maxRight - width));

  const belowTop = anchor.y + anchor.height + ANCHOR_GAP;
  const spaceBelow = Math.max(0, maxBottom - belowTop);
  const spaceAbove = Math.max(0, anchor.y - ANCHOR_GAP - minTop);

  const desiredHeight = Math.min(contentHeight, MAX_SUGGESTIONS_HEIGHT);
  const opensAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
  const maxHeight = Math.min(
    desiredHeight,
    opensAbove ? spaceAbove : spaceBelow,
  );
  const top = opensAbove ? anchor.y - ANCHOR_GAP - maxHeight : belowTop;

  return { left, maxHeight, top, width };
};
