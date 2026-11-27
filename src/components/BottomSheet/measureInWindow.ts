import { createContext, useContext } from 'react';
import type { HostInstance } from 'react-native';

type MeasureInWindowCallback = (
  x: number,
  y: number,
  width: number,
  height: number,
) => void;

export type MeasureInWindow = (
  node: HostInstance | null,
  callback: MeasureInWindowCallback,
) => void;

export const measureNodeInWindow: MeasureInWindow = (node, callback) => {
  node?.measureInWindow(callback);
};

export const MeasureInWindowContext =
  createContext<MeasureInWindow>(measureNodeInWindow);

/**
 * `measureInWindow` that also works inside a native sheet. The sheet's content
 * is laid out by Yoga where its host sits in the screen, but drawn natively at
 * the bottom of the window, so a plain measurement ignores that offset.
 */
export const useMeasureInWindow = () => useContext(MeasureInWindowContext);
