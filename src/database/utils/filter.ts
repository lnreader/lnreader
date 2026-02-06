import {
  ChapterFilterKey,
  ChapterFilterPositiveKey,
} from '@database/constants';

const FILTER_STATES = {
  'INDETERMINATE': 1,
  'OFF': 0,
  'ON': 2,
} as const;
export type FilterStates = typeof FILTER_STATES;

export class ChapterFilterObject {
  private filter: Map<
    ChapterFilterPositiveKey,
    FilterStates[keyof FilterStates]
  >;
  private setState: (value: ChapterFilterKey[]) => void;

  constructor(
    state?: ChapterFilterKey[],
    setState?: (value: ChapterFilterKey[]) => void,
  ) {
    this.filter = new Map();
    if (state && Array.isArray(state)) {
      state.forEach(key => {
        const v = key.split('-');
        const k = v[1] ?? v[0];
        this.filter.set(
          k as ChapterFilterPositiveKey,
          v.length === 1 ? FILTER_STATES.ON : FILTER_STATES.INDETERMINATE,
        );
      });
    }
    this.setState = setState ?? (() => {});
  }

  toArray(): ChapterFilterKey[] {
    const res = Array.from(this.filter.entries())
      .map(([key, value]) => {
        switch (value) {
          case FILTER_STATES.ON:
            return key;
          case FILTER_STATES.INDETERMINATE:
            return `not-${key}`;
          default:
            return null;
        }
      })
      .filter(v => v !== null);
    return res as ChapterFilterKey[];
  }

  set(key: ChapterFilterPositiveKey, value: keyof typeof FILTER_STATES) {
    this.filter.set(key, FILTER_STATES[value]);
    this.setState([...this.toArray()]);
    return this;
  }

  unset(key: ChapterFilterPositiveKey) {
    this.filter.delete(key);
    this.setState([...this.toArray()]);
    return this;
  }

  get(key: ChapterFilterPositiveKey) {
    return this.filter.get(key);
  }

  state(key: ChapterFilterPositiveKey) {
    const value = this.filter.get(key);
    if (!this.filter.has(key) || value === FILTER_STATES.OFF) {
      return false;
    } else if (value === FILTER_STATES.INDETERMINATE) {
      return 'indeterminate';
    }
    return true;
  }

  cycle(key: ChapterFilterPositiveKey) {
    switch (this.state(key)) {
      case 'indeterminate':
        this.set(key, 'OFF');
        break;
      case true:
        this.set(key, 'INDETERMINATE');
        break;
      default:
        this.set(key, 'ON');
    }
    return this;
  }

  getMap() {
    return this.filter;
  }
}
