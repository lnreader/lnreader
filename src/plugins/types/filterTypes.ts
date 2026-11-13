export interface FilterOption {
  readonly label: string;
  readonly value: string;
}

export enum FilterTypes {
  TextInput = 'Text',
  Picker = 'Picker',
  CheckboxGroup = 'Checkbox',
  Switch = 'Switch',
  ExcludableCheckboxGroup = 'XCheckbox',
}

interface FilterValueMap {
  [FilterTypes.TextInput]: string;
  [FilterTypes.Picker]: string;
  [FilterTypes.Switch]: boolean;
  [FilterTypes.CheckboxGroup]: string[];
  [FilterTypes.ExcludableCheckboxGroup]: {
    include?: string[];
    exclude?: string[];
  };
}

type WithOptions =
  | FilterTypes.Picker
  | FilterTypes.CheckboxGroup
  | FilterTypes.ExcludableCheckboxGroup;

type OptionsOf<T extends FilterTypes> = T extends WithOptions
  ? { options: readonly FilterOption[] }
  : object;

type WithAutocomplete = FilterTypes.TextInput;

type AutocompleteOf<T extends FilterTypes> = T extends WithAutocomplete
  ? { autocomplete?: boolean }
  : object;

export type ValueOfFilter<T extends FilterTypes> = FilterValueMap[T];

export type Filter<T extends FilterTypes = FilterTypes> = T extends FilterTypes
  ? {
      label: string;
      type: T;
      value: FilterValueMap[T];
    } & OptionsOf<T> &
      AutocompleteOf<T>
  : never;

export type Filters = Record<string, Filter<FilterTypes>>;

export type FilterType<T extends { type: unknown }> = T extends {
  type: infer K;
}
  ? K extends FilterTypes
    ? K
    : never
  : never;

export type FilterValueWithType<T extends FilterTypes> = {
  type: T;
  value: ValueOfFilter<T>;
};

export type FilterToValues<
  FilterObject extends Record<string, { type: FilterTypes }> | undefined,
> = FilterObject extends undefined
  ? undefined
  : {
      [K in keyof FilterObject]: FilterValueWithType<
        FilterType<NonNullable<FilterObject>[K]>
      >;
    };

export type AnyFilterValue = ValueOfFilter<FilterTypes>;

type FilterValueCheckMap = {
  [K in FilterTypes]: (v: unknown) => v is ValueOfFilter<K>;
};

const valueCheck: FilterValueCheckMap = {
  [FilterTypes.TextInput]: (v): v is string => typeof v === 'string',
  [FilterTypes.Picker]: (v): v is string => typeof v === 'string',
  [FilterTypes.Switch]: (v): v is boolean => typeof v === 'boolean',
  [FilterTypes.CheckboxGroup]: (v): v is string[] => Array.isArray(v),
  [FilterTypes.ExcludableCheckboxGroup]: (
    v,
  ): v is { include?: string[]; exclude?: string[] } =>
    !!v && typeof v === 'object' && !Array.isArray(v),
};

export const isFilterValue = <T extends FilterTypes>(
  q: FilterToValues<Filters>[string],
  type: T,
): q is FilterValueWithType<T> =>
  q.type === type && valueCheck[type](q.value as ValueOfFilter<T>);
