import React, { useState } from 'react';
import { Box, Column, FlowRow, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useBoolean } from '@hooks';

import { useTheme } from '@hooks/persisted/useTheme';
import { getString } from '@i18n/translations';
import {
  FilterTypes,
  type FilterToValues,
  type Filters,
} from '@plugins/types/filterTypes';
import { getValueFor } from './filterUtils';
import BlockIcon from '@expo/material-symbols/block.xml';
import ArrowDropDownIcon from '@expo/material-symbols/arrow_drop_down.xml';
import CheckIcon from '@expo/material-symbols/check.xml';
import FilterListIcon from '@expo/material-symbols/filter_list.xml';
import {
  BottomSheet,
  Button,
  Chip,
  AppText,
  TextInput,
  Menu,
  AppIcon,
  SwitchItem,
  List,
} from '@components';

export type SelectedFilters = FilterToValues<Filters>;
type FilterValue = SelectedFilters[string];

const toggle = (values: readonly string[], value: string) =>
  values.includes(value)
    ? values.filter(item => item !== value)
    : [...values, value];

interface FilterItemProps {
  filterKey: string;
  filter: Filters[string];
  selected: SelectedFilters;
  onChange: (key: string, value: FilterValue) => void;
}

const GroupTitle = ({ title }: { title: string }) => {
  const theme = useTheme();
  return (
    <AppText
      variant="titleSmall"
      color={theme.onSurfaceVariant}
      modifiers={[padding(16, 12, 16, 4)]}
    >
      {title}
    </AppText>
  );
};

const PickerItem = ({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: readonly { label: string; value: string }[];
  onSelect: (value: string) => void;
}) => {
  const {
    value: isVisible,
    setTrue: openCard,
    setFalse: closeCard,
  } = useBoolean();
  return (
    <Box modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
      <Menu
        visible={isVisible}
        onDismiss={closeCard}
        anchor={
          <Box modifiers={[fillMaxWidth(), clickable(openCard)]}>
            <TextInput
              outlined
              label={label}
              value={value}
              onChangeText={() => undefined}
              disabled
              trailing={<AppIcon source={ArrowDropDownIcon} />}
            />
          </Box>
        }
      >
        {options.map(option => (
          <Menu.Item
            key={option.label}
            title={option.label}
            onPress={() => {
              closeCard();
              onSelect(option.value);
            }}
          />
        ))}
      </Menu>
    </Box>
  );
};

const FilterItem = ({
  filterKey,
  filter,
  selected,
  onChange,
}: FilterItemProps) => {
  const theme = useTheme();
  const current = selected[filterKey];
  switch (filter.type) {
    case FilterTypes.TextInput: {
      const value = getValueFor<FilterTypes.TextInput>(filter, current);
      return (
        <TextInput
          outlined
          label={filter.label}
          value={value}
          onChangeText={text =>
            onChange(filterKey, { type: FilterTypes.TextInput, value: text })
          }
          modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}
        />
      );
    }
    case FilterTypes.Picker: {
      const value = getValueFor<FilterTypes.Picker>(filter, current);
      return (
        <PickerItem
          label={filter.label}
          value={
            filter.options.find(option => option.value === value)?.label ||
            'whatever'
          }
          options={filter.options}
          onSelect={next =>
            onChange(filterKey, { type: FilterTypes.Picker, value: next })
          }
        />
      );
    }
    case FilterTypes.Switch: {
      const value = getValueFor<FilterTypes.Switch>(filter, current);
      return (
        <SwitchItem
          label={filter.label}
          value={value}
          onPress={() =>
            onChange(filterKey, { type: FilterTypes.Switch, value: !value })
          }
          theme={theme}
        />
      );
    }
    case FilterTypes.CheckboxGroup: {
      const value = getValueFor<FilterTypes.CheckboxGroup>(filter, current);
      return (
        <Column modifiers={[fillMaxWidth()]}>
          <GroupTitle title={filter.label} />
          <FlowRow
            horizontalArrangement={{ spacedBy: 8 }}
            verticalArrangement={{ spacedBy: 0 }}
            modifiers={[fillMaxWidth(), padding(16, 0, 16, 8)]}
          >
            {filter.options.map(option => (
              <Chip
                key={option.value}
                label={option.label}
                selected={value.includes(option.value)}
                onPress={() =>
                  onChange(filterKey, {
                    type: FilterTypes.CheckboxGroup,
                    value: toggle(value, option.value),
                  })
                }
                theme={theme}
              />
            ))}
          </FlowRow>
        </Column>
      );
    }
    case FilterTypes.ExcludableCheckboxGroup: {
      const value = getValueFor<FilterTypes.ExcludableCheckboxGroup>(
        filter,
        current,
      );
      const include = value.include ?? [];
      const exclude = value.exclude ?? [];
      // Tapping cycles: off → include → exclude → off.
      const cycle = (option: string) => {
        const next = include.includes(option)
          ? {
              include: include.filter(item => item !== option),
              exclude: [...exclude, option],
            }
          : exclude.includes(option)
          ? { include, exclude: exclude.filter(item => item !== option) }
          : { include: [...include, option], exclude };
        onChange(filterKey, {
          type: FilterTypes.ExcludableCheckboxGroup,
          value: next,
        });
      };
      return (
        <Column modifiers={[fillMaxWidth()]}>
          <GroupTitle title={filter.label} />
          <FlowRow
            horizontalArrangement={{ spacedBy: 8 }}
            verticalArrangement={{ spacedBy: 0 }}
            modifiers={[fillMaxWidth(), padding(16, 0, 16, 8)]}
          >
            {filter.options.map(option => {
              const excluded = exclude.includes(option.value);
              return (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={excluded || include.includes(option.value)}
                  selectedIcon={excluded ? BlockIcon : CheckIcon}
                  tone={excluded ? 'error' : 'default'}
                  onPress={() => cycle(option.value)}
                  theme={theme}
                />
              );
            })}
          </FlowRow>
        </Column>
      );
    }
    default:
      return null;
  }
};

interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  filters: Filters;
  setFilters: (filters?: SelectedFilters) => void;
  clearFilters: (filters: Filters) => void;
  /** Laid out in place (a side pane on wide windows) instead of a sheet. */
  inline?: boolean;
}

const FilterBottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onDismiss,
  filters,
  clearFilters,
  setFilters,
  inline,
}) => {
  const theme = useTheme();
  const [selectedFilters, setSelectedFilters] =
    useState<SelectedFilters>(filters);

  const content = (
    <Column modifiers={[fillMaxWidth()]}>
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}
      >
        <AppText variant="titleLarge" modifiers={[weight(1)]}>
          {getString('common.filter')}
        </AppText>
        <Button
          mode="text"
          title={getString('common.reset')}
          onPress={() => {
            setSelectedFilters(filters);
            clearFilters(filters);
          }}
        />
        <Button
          mode="contained"
          icon={FilterListIcon}
          title={getString('common.filter')}
          onPress={() => {
            setFilters(selectedFilters);
            if (!inline) {
              onDismiss();
            }
          }}
        />
      </Row>
      <List.Divider theme={theme} />
      {Object.entries(filters).map(([key, filter]) => (
        <FilterItem
          key={key}
          filterKey={key}
          filter={filter}
          selected={selectedFilters}
          onChange={(filterKey, value) =>
            setSelectedFilters(prev => ({ ...prev, [filterKey]: value }))
          }
        />
      ))}
    </Column>
  );

  return inline ? (
    content
  ) : (
    <BottomSheet visible={visible} onDismiss={onDismiss} expanded>
      {content}
    </BottomSheet>
  );
};

export default FilterBottomSheet;
