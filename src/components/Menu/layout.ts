import { LayoutRectangle } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';

const HORIZONTAL_MARGIN = 16;
const VERTICAL_MARGIN = 8;
const ANCHOR_GAP = 4;

interface MenuPositionInput {
  anchor: LayoutRectangle;
  insets: EdgeInsets;
  menu: { height: number; width: number };
  screen: { height: number; width: number };
}

export const getAvailableMenuWidth = (
  screenWidth: number,
  insets: EdgeInsets,
) => screenWidth - insets.left - insets.right - HORIZONTAL_MARGIN * 2;

// The menu modal is drawn edge-to-edge (translucent status and navigation
// bars), so the system bar insets must be excluded from the usable area.
export const getMenuPosition = ({
  anchor,
  insets,
  menu,
  screen,
}: MenuPositionInput) => {
  const minLeft = insets.left + HORIZONTAL_MARGIN;
  const maxRight = screen.width - insets.right - HORIZONTAL_MARGIN;
  const minTop = insets.top + VERTICAL_MARGIN;
  const maxBottom = screen.height - insets.bottom - VERTICAL_MARGIN;

  const below = anchor.y + anchor.height + ANCHOR_GAP;
  const top =
    below + menu.height > maxBottom
      ? anchor.y - menu.height - ANCHOR_GAP
      : below;

  return {
    left: Math.max(minLeft, Math.min(anchor.x, maxRight - menu.width)),
    top: Math.max(minTop, Math.min(top, maxBottom - menu.height)),
  };
};
