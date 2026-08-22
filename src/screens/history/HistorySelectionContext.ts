import { createContext, Dispatch, SetStateAction, useContext } from 'react';

interface HistorySelectionContextValue {
  selectedIdsSet: Set<number>;
  hasSelection: boolean;
  toggleSelection: (id: number) => void;
  setSelectedNovelIds: Dispatch<SetStateAction<number[]>>;
}

const defaultValue: HistorySelectionContextValue = {
  selectedIdsSet: new Set(),
  hasSelection: false,
  toggleSelection: () => {},
  setSelectedNovelIds: () => {},
};

export const HistorySelectionContext =
  createContext<HistorySelectionContextValue>(defaultValue);

export const useHistorySelectionContext = () =>
  useContext(HistorySelectionContext);
