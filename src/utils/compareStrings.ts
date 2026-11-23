// `String.prototype.localeCompare` builds a platform collator on every call in
// Hermes on Android, which makes sorting a few hundred items take seconds.
// Reusing one collator keeps the same locale-aware ordering at a fraction of
// the cost.
const collator = new Intl.Collator();

export const compareStrings = (first: string, second: string) =>
  collator.compare(first, second);
