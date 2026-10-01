import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

export type WindowClass = 'compact' | 'medium' | 'expanded';

export const MEDIUM_MIN_WIDTH = 600;
export const EXPANDED_MIN_WIDTH = 840;

export const getWindowClass = (width: number): WindowClass => {
  if (width >= EXPANDED_MIN_WIDTH) {
    return 'expanded';
  }
  return width >= MEDIUM_MIN_WIDTH ? 'medium' : 'compact';
};

export interface WindowLayout {
  /** The window minus the navigation rail. */
  width: number;
  windowWidth: number;
  height: number;
  windowClass: WindowClass;
  isCompact: boolean;
  isExpanded: boolean;
  useNavigationRail: boolean;
}

export const getWindowLayout = (
  width: number,
  height: number,
  railWidth = 0,
): WindowLayout => {
  const windowClass = getWindowClass(width);
  return {
    width: width - railWidth,
    windowWidth: width,
    height,
    windowClass,
    isCompact: windowClass === 'compact',
    isExpanded: windowClass === 'expanded',
    useNavigationRail: windowClass !== 'compact',
  };
};

const RailWidthContext = createContext(0);

export const RailWidthProvider = RailWidthContext.Provider;

export const useWindowLayout = (): WindowLayout => {
  const { width, height } = useWindowDimensions();
  const railWidth = useContext(RailWidthContext);
  return getWindowLayout(width, height, railWidth);
};

export const MAX_CONTENT_WIDTH = 840;
