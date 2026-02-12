import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import BottomSheet from '@components/BottomSheet/BottomSheet';
import { BottomSheetFlatList, BottomSheetModal } from '@gorhom/bottom-sheet';

import { useTheme } from '@hooks/persisted';
import {
  FilterTypes,
  FilterToValues,
  Filters,
  ValueOfFilter,
} from '@plugins/types/filterTypes';
import { Button } from '@components/index';
import { overlay } from 'react-native-paper';
import { getValueFor } from '../filterUtils';
import { getString } from '@strings/translations';
import { ThemeColors } from '@theme/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FilterTextInput from './FilterTextInput';
import FilterPicker from './FilterPicker';
import FilterSwitch from './FilterSwitch';
import FilterCheckboxGroup from './FilterCheckboxGroup';
import FilterExcludableCheckboxGroup from './FilterExcludableCheckoxGroup';

const insertOrRemoveIntoArray = (array: string[], val: string): string[] =>
  array.indexOf(val) > -1 ? array.filter(ele => ele !== val) : [...array, val];

type SelectedFilters = FilterToValues<Filters>;

interface FilterItemProps {
  theme: ThemeColors;
  filter: Filters[string];
  filterKey: keyof Filters;
  selectedFilters: SelectedFilters;
  setSelectedFilters: React.Dispatch<React.SetStateAction<SelectedFilters>>;
}

const FilterItem: React.FC<FilterItemProps> = ({
  theme,
  filter,
  filterKey,
  selectedFilters,
  setSelectedFilters,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const value = getValueFor<(typeof filter)['type']>(
    filter,
    selectedFilters[filterKey],
  );
  const updateFilter = (newVal: any) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterKey]: { type: filter.type, value: newVal },
    }));
  };

  switch (filter.type) {
    case FilterTypes.TextInput:
      return (
        <FilterTextInput
          label={filter.label}
          value={value as string}
          setFilter={updateFilter}
          theme={theme}
          width={screenWidth - 48}
        />
      );

    case FilterTypes.Picker:
      return (
        <FilterPicker
          theme={theme}
          filter={filter}
          value={value as string}
          onSelect={updateFilter}
          screenWidth={screenWidth}
        />
      );

    case FilterTypes.Switch:
      return (
        <FilterSwitch
          theme={theme}
          label={filter.label}
          value={value as boolean}
          onToggle={() => updateFilter(!value)}
        />
      );

    case FilterTypes.CheckboxGroup:
      return (
        <FilterCheckboxGroup
          theme={theme}
          label={filter.label}
          options={filter.options}
          currentValues={value as string[]}
          onPressItem={val =>
            updateFilter(insertOrRemoveIntoArray(value as string[], val))
          }
        />
      );
    case FilterTypes.ExcludableCheckboxGroup:
      return (
        <FilterExcludableCheckboxGroup
          theme={theme}
          label={filter.label}
          options={filter.options}
          value={value as ValueOfFilter<FilterTypes.ExcludableCheckboxGroup>}
          onUpdate={nextVal => {
            setSelectedFilters(prev => ({
              ...prev,
              [filterKey]: {
                type: FilterTypes.ExcludableCheckboxGroup,
                value: nextVal,
              },
            }));
          }}
        />
      );
  }
};

interface BottomSheetProps {
  filterSheetRef: React.RefObject<BottomSheetModal | null>;
  filters: Filters;
  setFilters: (filters?: SelectedFilters) => void;
  clearFilters: (filters: Filters) => void;
}

const FilterBottomSheet: React.FC<BottomSheetProps> = ({
  filters,
  filterSheetRef,
  clearFilters,
  setFilters,
}) => {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [selectedFilters, setSelectedFilters] =
    useState<SelectedFilters>(filters);

  const backgroundColor = overlay(2, theme.surface);

  return (
    <BottomSheet
      bottomSheetRef={filterSheetRef}
      snapPoints={[400, 600]}
      bottomInset={bottom}
      backgroundStyle={{ backgroundColor }}
      handleComponent={null}
      children={
        <View style={styles.flex}>
          <View
            style={[
              styles.buttonContainer,
              { borderBottomColor: theme.outline },
            ]}
          >
            <Button
              title={getString('common.reset')}
              onPress={() => {
                setSelectedFilters(filters);
                clearFilters(filters);
              }}
            />
            <Button
              title={getString('common.filter')}
              textColor={theme.onPrimary}
              onPress={() => {
                setFilters(selectedFilters);
                filterSheetRef?.current?.close();
              }}
              mode="contained"
            />
          </View>
          <BottomSheetFlatList
            data={
              filters &&
              (Object.entries(filters) as [string, Filters[string]][])
            }
            keyExtractor={(item: [string, Filters[string]]) =>
              'filter' + item[0]
            }
            renderItem={({ item }: { item: [string, Filters[string]] }) => (
              <FilterItem
                theme={theme}
                filter={item[1]}
                filterKey={item[0]}
                selectedFilters={selectedFilters}
                setSelectedFilters={setSelectedFilters}
              />
            )}
          />
        </View>
      }
    />
  );
};

export default FilterBottomSheet;

const styles = StyleSheet.create({
  flex: { flex: 1 },

  buttonContainer: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});
