import type { ReaderPreferences } from '../../src/screens/reader/engine/preferences';
import type { FoliatePaginator } from './types';

export interface MarginalInfo {
  page?: number;
  pages?: number;
  fraction: number;
  /** 0–1, or -1 when unknown. */
  battery: number;
}

const clock = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const statusParts = (prefs: ReaderPreferences, info: MarginalInfo) => {
  const parts: string[] = [];
  if (prefs.showBatteryAndTime) {
    parts.push(clock());
  }
  if (prefs.showBatteryAndTime && info.battery >= 0) {
    parts.push(`${Math.round(info.battery * 100)}%`);
  }
  return parts;
};

export const renderMarginals = (
  paginator: FoliatePaginator,
  status: HTMLElement,
  prefs: ReaderPreferences,
  info: MarginalInfo,
) => {
  const heads = paginator.heads ?? [];
  const feet = paginator.feet ?? [];

  if (paginator.scrolled) {
    const parts = statusParts(prefs, info);
    if (prefs.showProgress) {
      parts.unshift(`${Math.round(info.fraction * 100)}%`);
    }
    status.textContent = parts.join('  ·  ');
    status.hidden = parts.length === 0;
    return;
  }
  status.hidden = true;

  heads.forEach(head => (head.textContent = ''));
  feet.forEach(foot => (foot.textContent = ''));
  const progress =
    prefs.showProgress && info.page && info.pages
      ? `${info.page} / ${info.pages}`
      : '';
  const extra = statusParts(prefs, info).join('  ·  ');
  if (feet.length > 1) {
    feet[0].textContent = extra;
    feet[feet.length - 1].textContent = progress;
  } else if (feet.length) {
    feet[0].textContent = [extra, progress].filter(Boolean).join('    ');
  }
};
