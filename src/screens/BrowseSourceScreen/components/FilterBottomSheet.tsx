import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  LayoutRectangle,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
  type HostInstance,
} from 'react-native';

import BottomSheet, {
  BottomSheetRef,
} from '@components/BottomSheet/BottomSheet';
import { TrueSheetOverlay } from '@lodev09/react-native-true-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@hooks/persisted';
import {
  FilterOption,
  FilterTypes,
  FilterToValues,
  Filters,
} from '@plugins/types/filterTypes';
import { Button, Menu } from '@components/index';
import { Checkbox } from '@components/Checkbox/Checkbox';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { useBoolean } from '@hooks';
import { useKeyboardHeight } from '@hooks/common/useKeyboardHeight';
import { TextInput, overlay } from 'react-native-paper';
import {
  addMultiTextValues,
  getEstimatedSuggestionsHeight,
  getSuggestionPlacement,
  getValueFor,
} from './filterUtils';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import Switch from '@components/Switch/Switch';
import { useFilterSuggestions } from '../useFilterSuggestions';

const insertOrRemoveIntoArray = (array: string[], val: string): string[] =>
  array.indexOf(val) > -1 ? array.filter(ele => ele !== val) : [...array, val];

type SelectedFilters = FilterToValues<Filters>;

interface FilterSuggestionOverlayProps {
  children: React.ReactNode;
  onSelect: (option: FilterOption) => void;
  style?: StyleProp<ViewStyle>;
  suggestions: FilterOption[];
  theme: ThemeColors;
  visible: boolean;
}

/**
 * Anchors a suggestion list to a text field and renders it in a window-level
 * overlay, so the list is not painted behind the FlatList cells that follow
 * the field. A react-native-paper Portal would sit under the native sheet.
 */
const FilterSuggestionOverlay: React.FC<FilterSuggestionOverlayProps> = ({
  children,
  onSelect,
  style,
  suggestions,
  theme,
  visible,
}) => {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const anchorRef = useRef<HostInstance>(null);

  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);

  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setAnchor({ x, y, width, height });
      }
    });
  }, []);

  // The list is shown after the field has settled, but the anchor can still
  // move (sheet snap, keyboard, chip row) while the list is open.
  useEffect(() => {
    if (visible) {
      measureAnchor();
    }
  }, [measureAnchor, visible, keyboardHeight, screenHeight, screenWidth]);

  const placement =
    anchor &&
    getSuggestionPlacement({
      anchor,
      contentHeight: getEstimatedSuggestionsHeight(suggestions.length),
      // The window does not shrink when the keyboard opens, so clamp the list
      // to the area above the IME instead of the navigation bar.
      insets: {
        ...insets,
        bottom: Math.max(insets.bottom, keyboardHeight),
      },
      screen: { height: screenHeight, width: screenWidth },
    });

  return (
    <>
      <View
        collapsable={false}
        onLayout={visible ? measureAnchor : undefined}
        ref={anchorRef}
        style={style}
      >
        {children}
      </View>
      {visible && placement ? (
        <TrueSheetOverlay>
          <View pointerEvents="box-none" style={styles.suggestionOverlayHost}>
            <View
              accessibilityRole="menu"
              style={[
                styles.suggestionOverlay,
                {
                  backgroundColor: theme.surfaceVariant,
                  borderColor: theme.outlineVariant,
                  left: placement.left,
                  top: placement.top,
                  width: placement.width,
                },
              ]}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                style={{ maxHeight: placement.maxHeight }}
              >
                {suggestions.map(option => (
                  <Pressable
                    key={option.value}
                    accessibilityRole="menuitem"
                    onPress={() => onSelect(option)}
                    android_ripple={{ color: theme.rippleColor }}
                    style={styles.suggestionItem}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ color: theme.onSurfaceVariant }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </TrueSheetOverlay>
      ) : null}
    </>
  );
};

interface MultiTextFilterProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  pluginId: string;
  filterKey: string;
  autocomplete?: boolean;
  registerDismiss: (dismiss: () => void) => () => void;
  theme: ThemeColors;
}

const MultiTextFilter: React.FC<MultiTextFilterProps> = ({
  label,
  value,
  onChange,
  pluginId,
  filterKey,
  autocomplete,
  registerDismiss,
  theme,
}) => {
  const [input, setInput] = useState('');

  // Commit on submit, split pasted newlines, commas stay literal.
  const commit = (rawText: string) => {
    const next = addMultiTextValues(value, rawText.split('\n'));
    if (next.length !== value.length) {
      onChange(next);
    }
    setInput('');
  };

  const field = useFilterSuggestions(
    pluginId,
    filterKey,
    autocomplete ? input : '',
    option => commit(option.value),
  );

  useEffect(
    () => registerDismiss(field.dismiss),
    [field.dismiss, registerDismiss],
  );

  return (
    <View style={styles.multiTextContainer}>
      {value.length > 0 ? (
        <View style={styles.chips}>
          {value.map(chip => (
            <View
              key={chip}
              style={[
                styles.chip,
                { backgroundColor: theme.secondaryContainer },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${getString('common.edit')} ${chip}`}
                onPress={() => {
                  setInput(chip);
                  onChange(value.filter(v => v !== chip));
                }}
                style={styles.chipLabel}
              >
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{ color: theme.onSecondaryContainer }}
                >
                  {chip}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${getString('common.remove')} ${chip}`}
                hitSlop={8}
                onPress={() => onChange(value.filter(v => v !== chip))}
                style={styles.chipClose}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={16}
                  color={theme.onSecondaryContainer}
                />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <FilterSuggestionOverlay
        visible={field.isVisible}
        suggestions={field.suggestions}
        onSelect={field.select}
        theme={theme}
      >
        <TextInput
          testID="multiTextInput"
          style={styles.textInput}
          mode="outlined"
          label={
            <Text
              style={[
                {
                  color: theme.onSurface,
                  backgroundColor: overlay(2, theme.surface),
                },
              ]}
            >
              {` ${label} `}
            </Text>
          }
          value={input}
          onChangeText={text => {
            if (autocomplete) {
              field.onEdit();
            }
            // A newline only arrives via paste, so split it into chips now.
            if (text.includes('\n')) {
              commit(text);
            } else {
              setInput(text);
            }
          }}
          onSubmitEditing={() => commit(input)}
          returnKeyType="done"
          theme={{ colors: { background: 'transparent' } }}
          outlineColor={theme.onSurface}
          textColor={theme.onSurface}
          {...(autocomplete
            ? { onFocus: field.onFocus, onBlur: field.onBlur }
            : {})}
          right={
            <TextInput.Icon
              icon="plus"
              disabled={!input.trim()}
              onPress={() => commit(input)}
            />
          }
        />
      </FilterSuggestionOverlay>
    </View>
  );
};

interface FilterItemProps {
  theme: ThemeColors;
  filter: Filters[string];
  filterKey: keyof Filters;
  pluginId: string;
  registerDismiss: (dismiss: () => void) => () => void;
  selectedFilters: SelectedFilters;
  setSelectedFilters: React.Dispatch<React.SetStateAction<SelectedFilters>>;
}

const FilterItem: React.FC<FilterItemProps> = ({
  theme,
  filter,
  filterKey,
  pluginId,
  registerDismiss,
  selectedFilters,
  setSelectedFilters,
}) => {
  const {
    value: isVisible,
    toggle: toggleCard,
    setFalse: closeCard,
  } = useBoolean();
  const { width: screenWidth } = useWindowDimensions();

  const isAutocomplete =
    filter.type === FilterTypes.TextInput &&
    'autocomplete' in filter &&
    !!filter.autocomplete;
  const field = useFilterSuggestions(
    pluginId,
    filterKey,
    isAutocomplete
      ? String(getValueFor<FilterTypes>(filter, selectedFilters[filterKey]))
      : '',
    option => {
      setSelectedFilters(prevState => ({
        ...prevState,
        [filterKey]: { value: option.value, type: FilterTypes.TextInput },
      }));
    },
  );

  useEffect(
    () => registerDismiss(field.dismiss),
    [field.dismiss, registerDismiss],
  );

  if (filter.type === FilterTypes.TextInput) {
    const value = getValueFor<(typeof filter)['type']>(
      filter,
      selectedFilters[filterKey],
    );

    return (
      <View style={styles.textContainer}>
        <FilterSuggestionOverlay
          visible={field.isVisible}
          suggestions={field.suggestions}
          onSelect={field.select}
          style={{ width: screenWidth - 48 }}
          theme={theme}
        >
          <TextInput
            style={styles.flex}
            mode="outlined"
            label={
              <Text
                style={[
                  {
                    color: theme.onSurface,
                    backgroundColor: overlay(2, theme.surface),
                  },
                ]}
              >
                {` ${filter.label} `}
              </Text>
            }
            theme={{ colors: { background: 'transparent' } }}
            outlineColor={theme.onSurface}
            textColor={theme.onSurface}
            onChangeText={text => {
              if (isAutocomplete) {
                field.onEdit();
              }
              setSelectedFilters(prevState => ({
                ...prevState,
                [filterKey]: { value: text, type: FilterTypes.TextInput },
              }));
            }}
            {...(isAutocomplete
              ? { value, onFocus: field.onFocus, onBlur: field.onBlur }
              : { defaultValue: value })}
          />
        </FilterSuggestionOverlay>
      </View>
    );
  }
  if (filter.type === FilterTypes.Picker) {
    const value = getValueFor<(typeof filter)['type']>(
      filter,
      selectedFilters[filterKey],
    );
    const label =
      filter.options.find(option => option.value === value)?.label ||
      'whatever';
    return (
      <View style={styles.pickerContainer}>
        <Menu
          fullWidth
          visible={isVisible}
          contentStyle={{ backgroundColor: theme.surfaceVariant }}
          anchor={
            <Pressable
              style={[styles.flex, { width: screenWidth - 48 }]}
              onPress={toggleCard}
            >
              <TextInput
                mode="outlined"
                label={
                  <Text
                    style={[
                      {
                        color: isVisible ? theme.primary : theme.onSurface,
                        backgroundColor: overlay(2, theme.surface),
                      },
                    ]}
                  >
                    {` ${filter.label} `}
                  </Text>
                }
                value={label}
                editable={false}
                theme={{ colors: { background: 'transparent' } }}
                outlineColor={isVisible ? theme.primary : theme.onSurface}
                textColor={isVisible ? theme.primary : theme.onSurface}
              />
            </Pressable>
          }
          onDismiss={closeCard}
        >
          {filter.options.map(val => {
            return (
              <Menu.Item
                key={val.label}
                title={val.label}
                titleStyle={{ color: theme.onSurfaceVariant }}
                onPress={() => {
                  closeCard();
                  setSelectedFilters(prevFilters => ({
                    ...prevFilters,
                    [filterKey]: { value: val.value, type: FilterTypes.Picker },
                  }));
                }}
              />
            );
          })}
        </Menu>
      </View>
    );
  }
  if (filter.type === FilterTypes.CheckboxGroup) {
    const value = getValueFor<(typeof filter)['type']>(
      filter,
      selectedFilters[filterKey],
    );
    return (
      <View>
        <Pressable
          style={styles.checkboxHeader}
          onPress={toggleCard}
          android_ripple={{ color: theme.rippleColor }}
        >
          <Text style={[{ color: theme.onSurfaceVariant }]}>
            {filter.label}
          </Text>
          <MaterialCommunityIcons
            name={isVisible ? 'chevron-up' : 'chevron-down'}
            color={theme.onSurface}
            size={24}
          />
        </Pressable>
        {isVisible
          ? filter.options.map(val => {
              return (
                <Checkbox
                  key={val.label}
                  label={val.label}
                  theme={theme}
                  status={value.includes(val.value)}
                  onPress={() =>
                    setSelectedFilters(prevFilters => ({
                      ...prevFilters,
                      [filterKey]: {
                        type: FilterTypes.CheckboxGroup,
                        value: insertOrRemoveIntoArray(value, val.value),
                      },
                    }))
                  }
                />
              );
            })
          : null}
      </View>
    );
  }
  if (filter.type === FilterTypes.Switch) {
    const value = getValueFor<(typeof filter)['type']>(
      filter,
      selectedFilters[filterKey],
    );
    return (
      <Pressable
        android_ripple={{ color: theme.rippleColor }}
        style={styles.container}
        onPress={() => {
          setSelectedFilters(prevState => ({
            ...prevState,
            [filterKey]: { value: !value, type: FilterTypes.Switch },
          }));
        }}
      >
        <View style={styles.switchContainer}>
          <View style={styles.switchLabelContainer}>
            <Text style={[{ color: theme.onSurface }, styles.switchLabel]}>
              {filter.label}
            </Text>
          </View>
          <Switch
            value={value}
            onValueChange={() => {
              setSelectedFilters(prevState => ({
                ...prevState,
                [filterKey]: { value: !value, type: FilterTypes.Switch },
              }));
            }}
          />
        </View>
      </Pressable>
    );
  }
  if (filter.type === FilterTypes.ExcludableCheckboxGroup) {
    const value = getValueFor<(typeof filter)['type']>(
      filter,
      selectedFilters[filterKey],
    );
    return (
      <View>
        <Pressable
          style={styles.checkboxHeader}
          onPress={toggleCard}
          android_ripple={{ color: theme.rippleColor }}
        >
          <Text style={[{ color: theme.onSurfaceVariant }]}>
            {filter.label}
          </Text>
          <MaterialCommunityIcons
            name={isVisible ? 'chevron-up' : 'chevron-down'}
            color={theme.onSurface}
            size={24}
          />
        </Pressable>
        {isVisible
          ? filter.options.map(val => {
              return (
                <Checkbox
                  key={val.label}
                  label={val.label}
                  theme={theme}
                  status={
                    value.include?.includes(val.value)
                      ? true
                      : value.exclude?.includes(val.value)
                      ? 'indeterminate'
                      : false
                  }
                  onPress={() => {
                    if (value.exclude?.includes(val.value)) {
                      setSelectedFilters(prev => {
                        return {
                          ...prev,
                          [filterKey]: {
                            type: FilterTypes.ExcludableCheckboxGroup,
                            value: {
                              include: [...(value.include || [])],
                              exclude: [
                                ...(value.exclude?.filter(
                                  f => f !== val.value,
                                ) || []),
                              ],
                            },
                          },
                        };
                      });
                    } else if (value.include?.includes(val.value)) {
                      setSelectedFilters(prev => {
                        return {
                          ...prev,
                          [filterKey]: {
                            type: FilterTypes.ExcludableCheckboxGroup,
                            value: {
                              include: [
                                ...(value.include?.filter(
                                  f => f !== val.value,
                                ) || []),
                              ],
                              exclude: [...(value.exclude || []), val.value],
                            },
                          },
                        };
                      });
                    } else {
                      setSelectedFilters(prev => {
                        return {
                          ...prev,
                          [filterKey]: {
                            type: FilterTypes.ExcludableCheckboxGroup,
                            value: {
                              include: [...(value.include || []), val.value],
                              exclude: value.exclude,
                            },
                          },
                        };
                      });
                    }
                  }}
                />
              );
            })
          : null}
      </View>
    );
  }
  if (filter.type === FilterTypes.MultiText) {
    const value = getValueFor<(typeof filter)['type']>(
      filter,
      selectedFilters[filterKey],
    );
    return (
      <MultiTextFilter
        label={filter.label}
        value={value}
        pluginId={pluginId}
        filterKey={filterKey}
        autocomplete={filter.autocomplete}
        registerDismiss={registerDismiss}
        theme={theme}
        onChange={next =>
          setSelectedFilters(prevState => ({
            ...prevState,
            [filterKey]: { type: FilterTypes.MultiText, value: next },
          }))
        }
      />
    );
  }
  return <></>;
};

const SNAP_POINTS = [400, 600];

interface BottomSheetProps {
  filterSheetRef: React.RefObject<BottomSheetRef | null>;
  filters: Filters;
  pluginId: string;
  setFilters: (filters?: SelectedFilters) => void;
  clearFilters: (filters: Filters) => void;
}

const FilterBottomSheet: React.FC<BottomSheetProps> = ({
  filters,
  filterSheetRef,
  pluginId,
  clearFilters,
  setFilters,
}) => {
  const theme = useTheme();
  const [selectedFilters, setSelectedFilters] =
    useState<SelectedFilters>(filters);
  // Reset remounts the list so fields with local drafts (e.g. MultiText) clear.
  const [resetVersion, setResetVersion] = useState(0);
  const listRef = useRef<FlatList<[string, Filters[string]]>>(null);

  // Suggestions are portaled above the sheet, so they must close whenever the
  // field that anchors them moves or the sheet goes away.
  const dismissers = useRef(new Set<() => void>());
  const registerDismiss = useCallback((dismiss: () => void) => {
    dismissers.current.add(dismiss);
    return () => {
      dismissers.current.delete(dismiss);
    };
  }, []);
  const dismissSuggestions = useCallback(() => {
    dismissers.current.forEach(dismiss => dismiss());
  }, []);

  return (
    <BottomSheet
      bottomSheetRef={filterSheetRef}
      onChange={dismissSuggestions}
      snapPoints={SNAP_POINTS}
      scrollableRef={listRef}
    >
      <View style={styles.flex}>
        <View
          style={[
            styles.buttonContainer,
            { borderBottomColor: theme.outlineVariant },
          ]}
        >
          <Button
            title={getString('common.reset')}
            onPress={() => {
              setSelectedFilters(filters);
              clearFilters(filters);
              setResetVersion(current => current + 1);
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
        <FlatList
          ref={listRef}
          data={
            filters && (Object.entries(filters) as [string, Filters[string]][])
          }
          keyExtractor={(item: [string, Filters[string]]) =>
            `filter${item[0]}-${resetVersion}`
          }
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={dismissSuggestions}
          renderItem={({ item }: { item: [string, Filters[string]] }) => (
            <FilterItem
              theme={theme}
              filter={item[1]}
              filterKey={item[0]}
              pluginId={pluginId}
              registerDismiss={registerDismiss}
              selectedFilters={selectedFilters}
              setSelectedFilters={setSelectedFilters}
            />
          )}
        />
      </View>
    </BottomSheet>
  );
};

export default FilterBottomSheet;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  transparent: {
    backgroundColor: 'transparent',
  },
  buttonContainer: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  checkboxHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  container: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    flex: 1,
  },

  picker: {
    paddingHorizontal: 24,
    width: 200,
  },
  pickerContainer: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
  suggestionOverlayHost: StyleSheet.absoluteFill,
  suggestionOverlay: {
    borderRadius: 4,
    borderWidth: 1,
    elevation: 4,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  switchContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
  switchLabel: {
    fontSize: 16,
  },
  switchLabelContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
  multiTextContainer: {
    marginVertical: 8,
    paddingHorizontal: 24,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipLabel: { flexShrink: 1, minWidth: 0 },
  chipClose: { flexShrink: 0 },
  textInput: { width: '100%' },
});
