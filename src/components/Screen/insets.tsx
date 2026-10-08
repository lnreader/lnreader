import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ScreenInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

type InsetOverride = Partial<Record<keyof ScreenInsets, number>>;

const InsetOverrideContext = createContext<InsetOverride | null>(null);

/**
 * Screens inside the tab navigator sit above the navigation bar (or beside
 * the rail), which already consumes that edge's system inset.
 */
export const InsetOverrideProvider = ({
  value,
  children,
}: {
  value: InsetOverride;
  children: ReactNode;
}) => (
  <InsetOverrideContext.Provider value={value}>
    {children}
  </InsetOverrideContext.Provider>
);

export const useScreenInsets = (): ScreenInsets => {
  const safe = useSafeAreaInsets();
  const override = useContext(InsetOverrideContext);
  return useMemo(
    () => ({
      top: override?.top ?? safe.top,
      bottom: override?.bottom ?? safe.bottom,
      left: override?.left ?? safe.left,
      right: override?.right ?? safe.right,
    }),
    [override, safe.bottom, safe.left, safe.right, safe.top],
  );
};
