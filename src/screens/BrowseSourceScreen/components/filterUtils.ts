import {
  FilterToValues,
  FilterTypes,
  Filters,
  isFilterValue,
  ValueOfFilter,
} from '@plugins/types/filterTypes';

export const getValueFor = <T extends FilterTypes>(
  filter: Filters[string],
  value: FilterToValues<Filters>[string],
): ValueOfFilter<T> =>
  (isFilterValue(value, filter.type)
    ? value.value
    : filter.value) as ValueOfFilter<T>;

/**
 * Append free-text values to a {@link FilterTypes.MultiText} value, trimming
 * whitespace and dropping blanks and duplicates.
 */
export const addMultiTextValues = (
  current: readonly string[],
  rawValues: readonly string[],
): string[] => {
  const next = [...current];
  rawValues.forEach(rawValue => {
    const value = rawValue.trim();
    if (value && !next.includes(value)) {
      next.push(value);
    }
  });
  return next;
};
