const MAX_WIDTH = 640;
const COMPACT_TOP_MARGIN = 72;
const LARGE_WINDOW_MARGIN = 56;

interface BottomSheetLayoutInput {
  bottom: number;
  height: number;
  top: number;
  width: number;
}

export const getBottomSheetLayout = ({
  bottom,
  height,
  top,
  width,
}: BottomSheetLayoutInput) => {
  const isLargeWindow = width > MAX_WIDTH;
  const topMargin = isLargeWindow ? LARGE_WINDOW_MARGIN : COMPACT_TOP_MARGIN;
  const horizontalInset = isLargeWindow
    ? Math.max(LARGE_WINDOW_MARGIN, (width - MAX_WIDTH) / 2)
    : 0;

  return {
    horizontalInset,
    maxHeight: Math.max(0, height - top - bottom - topMargin),
    topMargin,
  };
};

// Snap points describe the visible content height; the sheet also extends
// behind the navigation bar, so the bottom inset is added on top.
export const normalizeBottomSheetSnapPoints = (
  snapPoints: number[] | undefined,
  maxHeight: number,
  bottomInset: number,
) =>
  snapPoints
    ? [...snapPoints]
        .sort((a, b) => a - b)
        .map(point => Math.min(point, maxHeight) + bottomInset)
    : undefined;
