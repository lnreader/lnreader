import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { Checkbox } from '@components/Checkbox/Checkbox';
import { ThemeColors } from '@theme/types';
import {
  FilterOption,
  FilterTypes,
  ValueOfFilter,
} from '@plugins/types/filterTypes';
import { useBoolean } from '@hooks/index';

type ExcludableValue = ValueOfFilter<FilterTypes.ExcludableCheckboxGroup>;

interface FilterExcludableCheckboxGroupProps {
  theme: ThemeColors;
  label: string;
  options: readonly FilterOption[];
  value: ExcludableValue;
  onUpdate: (newValue: ExcludableValue) => void;
}

export default function FilterExcludableCheckboxGroup({
  theme,
  label,
  options,
  value,
  onUpdate,
}: FilterExcludableCheckboxGroupProps) {
  const { value: isVisible, toggle: toggleVisible } = useBoolean();

  const handlePress = (itemValue: string) => {
    const includes = value.include || [];
    const excludes = value.exclude || [];

    let nextValue: ExcludableValue;

    if (includes.includes(itemValue)) {
      // Transition: Include -> Exclude
      nextValue = {
        include: includes.filter(v => v !== itemValue),
        exclude: [...excludes, itemValue],
      };
    } else if (excludes.includes(itemValue)) {
      // Transition: Exclude -> None
      nextValue = {
        include: includes,
        exclude: excludes.filter(v => v !== itemValue),
      };
    } else {
      // Transition: None -> Include
      nextValue = {
        include: [...includes, itemValue],
        exclude: excludes,
      };
    }
    onUpdate(nextValue);
  };

  return (
    <View>
      <Pressable
        style={styles.checkboxHeader}
        onPress={toggleVisible}
        android_ripple={{ color: theme.rippleColor }}
      >
        <Text style={{ color: theme.onSurfaceVariant }}>{label}</Text>
        <MaterialCommunityIcons
          name={isVisible ? 'chevron-up' : 'chevron-down'}
          color={theme.onSurface}
          size={24}
        />
      </Pressable>
      {isVisible &&
        options.map(opt => {
          const isIncluded = value.include?.includes(opt.value);
          const isExcluded = value.exclude?.includes(opt.value);

          return (
            <Checkbox
              key={opt.label}
              label={opt.label}
              theme={theme}
              status={isIncluded ? true : isExcluded ? 'indeterminate' : false}
              onPress={() => handlePress(opt.value)}
            />
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  checkboxHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
});
