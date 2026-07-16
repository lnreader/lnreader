import { createContext, Dispatch, SetStateAction, useContext } from 'react';

interface SelectionContextValue {
  selectedIdsSet: Set<number>;
  hasSelection: boolean;
  toggleSelection: (id: number) => void;
  setSelectedNovelIds: Dispatch<SetStateAction<number[]>>;
}

const defaultValue: SelectionContextValue = {
  selectedIdsSet: new Set(),
  hasSelection: false,
  toggleSelection: () => {},
  setSelectedNovelIds: () => {},
};

export const SelectionContext =
  createContext<SelectionContextValue>(defaultValue);

export const useSelectionContext = () => useContext(SelectionContext);
