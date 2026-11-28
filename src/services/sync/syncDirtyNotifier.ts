let syncDirtyListener: (() => void) | null = null;

export const registerSyncDirtyListener = (listener: () => void): void => {
  syncDirtyListener = listener;
};

export const notifyChapterStateChanged = (): void => {
  syncDirtyListener?.();
};
