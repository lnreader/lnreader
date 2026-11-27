const MAX_WIDTH = 640;
const COMPACT_TOP_MARGIN = 72;
const LARGE_WINDOW_MARGIN = 56;
const MAX_DETENTS = 3;

interface BottomSheetLayoutInput {
  bottom: number;
  height: number;
  top: number;
  width: number;
}

export const getBottomSheetMaxHeight = ({
  bottom,
  height,
  top,
  width,
}: BottomSheetLayoutInput) => {
  const topMargin =
    width > MAX_WIDTH ? LARGE_WINDOW_MARGIN : COMPACT_TOP_MARGIN;
  return Math.max(0, height - top - bottom - topMargin);
};

// Snap points describe the visible content height in dp. TrueSheet detents are
// fractions of the window height, and it adds the navigation bar inset on top.
export const toBottomSheetDetents = (
  snapPoints: number[],
  maxHeight: number,
  windowHeight: number,
) =>
  [...snapPoints]
    .sort((a, b) => a - b)
    .slice(0, MAX_DETENTS)
    .map(point => {
      const fraction = Math.min(point, maxHeight) / windowHeight;
      return Math.min(1, Math.max(0.01, fraction));
    });
