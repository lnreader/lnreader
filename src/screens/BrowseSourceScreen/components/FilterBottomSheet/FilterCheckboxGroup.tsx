import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { Checkbox } from '@components/Checkbox/Checkbox';
import { ThemeColors } from '@theme/types';
import { useBoolean } from '@hooks/index';
import { FilterOption } from '@plugins/types/filterTypes';

interface FilterCheckboxGroupProps {
  theme: ThemeColors;
  label: string;
  options: readonly FilterOption[];
  currentValues: string[] | { include?: string[]; exclude?: string[] };
  onPressItem: (val: string) => void;
  isExcludable?: boolean;
}

export default function FilterCheckboxGroup({
  theme,
  label,
  options,
  currentValues,
  onPressItem,
  isExcludable,
}: FilterCheckboxGroupProps) {
  const { value: isVisible, toggle: toggleVisible } = useBoolean();

  const getStatus = (val: string) => {
    if (isExcludable) {
      const v = currentValues as { include?: string[]; exclude?: string[] };
      if (v.include?.includes(val)) return true;
      if (v.exclude?.includes(val)) return 'indeterminate';
      return false;
    }
    return (currentValues as string[]).includes(val);
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
        options.map(val => (
          <Checkbox
            key={val.label}
            label={val.label}
            theme={theme}
            status={getStatus(val.value)}
            onPress={() => onPressItem(val.value)}
          />
        ))}
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
