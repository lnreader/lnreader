'use no memo';

/**
 * Jest can't run the native Jetpack Compose views @expo/ui renders on
 * Android, so this replaces the jetpack-compose entry point (and its
 * modifiers subpath) with plain React Native primitives that preserve the
 * props/callbacks LNReader wrappers rely on (selection state, onClick,
 * colors, observable text state) for behavioral testing.
 *
 * The `"use no memo"` directive above opts this file out of
 * babel-plugin-react-compiler: the compiler's per-file memoization cache
 * would otherwise be referenced from inside these jest.mock() factories,
 * which Jest rejects as an out-of-scope variable access.
 */
jest.mock('@expo/ui/jetpack-compose', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');

  const Host = ({ children, style }) =>
    React.createElement(View, { style }, children);

  const SingleChoiceSegmentedButtonRow = ({ children }) =>
    React.createElement(View, { accessibilityRole: 'radiogroup' }, children);

  const MultiChoiceSegmentedButtonRow = ({ children }) =>
    React.createElement(View, null, children);

  const SegmentedButtonLabel = ({ children }) =>
    React.createElement(Text, null, children);

  const SegmentedButton = ({
    selected,
    checked,
    onClick,
    onCheckedChange,
    enabled = true,
    colors,
    children,
  }) =>
    React.createElement(
      Pressable,
      {
        accessibilityRole: 'radio',
        accessibilityState: {
          checked: selected ?? checked ?? false,
          disabled: !enabled,
        },
        disabled: !enabled,
        onPress: () => {
          onClick?.();
          if (onCheckedChange) onCheckedChange(!checked);
        },
        testID: 'segmented-button',
        colors,
      },
      children,
    );
  SegmentedButton.Label = SegmentedButtonLabel;

  const TriStateCheckbox = ({ state, onClick, enabled = true, colors }) =>
    React.createElement(Pressable, {
      accessibilityRole: 'checkbox',
      accessibilityState: {
        checked:
          state === 'on' ? true : state === 'indeterminate' ? 'mixed' : false,
        disabled: !enabled,
      },
      disabled: !enabled,
      onPress: onClick,
      testID: 'tri-state-checkbox',
      colors,
    });

  const Switch = ({ value, colors }) =>
    React.createElement(View, {
      accessibilityRole: 'switch',
      accessibilityState: { checked: value },
      testID: 'compose-switch',
      colors,
    });

  // Real Compose Buttons/Chips render plain string children as native Text
  // internally; the mock does the same so `getByText` queries keep working.
  const renderChildren = children =>
    typeof children === 'string'
      ? React.createElement(Text, null, children)
      : children;

  const createButtonComponent = testID => {
    const Component = ({ onClick, enabled = true, colors, children }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          disabled: !enabled,
          onPress: onClick,
          testID,
          colors,
        },
        renderChildren(children),
      );
    return Component;
  };
  const ComposeButton = createButtonComponent('button-contained');
  const FilledTonalButton = createButtonComponent('button-contained-tonal');
  const OutlinedButton = createButtonComponent('button-outlined');
  const ElevatedButton = createButtonComponent('button-elevated');
  const TextButton = createButtonComponent('button-text');

  const createChipComponent = testID => {
    const Component = ({ selected, onClick, colors, border, children }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityState: selected !== undefined ? { selected } : undefined,
          onPress: onClick,
          testID,
          colors,
          border,
        },
        children,
      );
    Component.Label = ({ children }) =>
      React.createElement(Text, null, children);
    return Component;
  };
  const AssistChip = createChipComponent('assist-chip');
  const FilterChip = createChipComponent('filter-chip');

  const CircularProgressIndicator = ({ color, progress }) =>
    React.createElement(View, {
      accessibilityRole: 'progressbar',
      testID: 'circular-progress-indicator',
      color,
      progress,
    });

  const ExposedDropdownMenuBox = ({ expanded, onExpandedChange, children }) =>
    React.createElement(
      Pressable,
      {
        testID: 'exposed-dropdown-menu-box',
        onPress: () => onExpandedChange?.(!expanded),
      },
      children,
    );

  const ExposedDropdownMenu = ({ expanded, children }) =>
    expanded
      ? React.createElement(
          View,
          { accessibilityRole: 'menu', testID: 'exposed-dropdown-menu' },
          children,
        )
      : null;

  const DropdownMenuItem = ({
    onClick,
    enabled = true,
    elementColors,
    children,
  }) =>
    React.createElement(
      Pressable,
      {
        accessibilityRole: 'menuitem',
        disabled: !enabled,
        onPress: onClick,
        testID: 'dropdown-menu-item',
        elementColors,
      },
      children,
    );
  DropdownMenuItem.Text = ({ children }) =>
    React.createElement(Text, null, children);

  function useNativeState(initial) {
    const ref = React.useRef(null);
    if (!ref.current) {
      let current = initial;
      let listeners = [];
      ref.current = {
        get value() {
          return current;
        },
        set value(next) {
          current = next;
          listeners.forEach(listener => listener(next));
        },
        get() {
          return current;
        },
        set(next) {
          current = next;
          listeners.forEach(listener => listener(next));
        },
        onChange: null,
        __subscribe(listener) {
          listeners.push(listener);
          return () => {
            listeners = listeners.filter(l => l !== listener);
          };
        },
      };
    }
    return ref.current;
  }

  const createTextFieldComponent = testID => {
    const Component = ({ value, readOnly, colors, children }) => {
      const [text, setText] = React.useState(value?.value ?? '');
      React.useEffect(() => {
        if (!value || typeof value.__subscribe !== 'function') return undefined;
        return value.__subscribe(setText);
      }, [value]);
      return React.createElement(
        View,
        {
          testID,
          accessibilityState: { disabled: !!readOnly },
          colors,
        },
        React.createElement(Text, { testID: `${testID}-value` }, text),
        children,
      );
    };
    Component.Label = ({ children }) =>
      React.createElement(Text, null, children);
    return Component;
  };
  const TextField = createTextFieldComponent('text-field');
  const OutlinedTextField = createTextFieldComponent('outlined-text-field');

  const ComposeText = ({ children }) =>
    React.createElement(Text, null, children);

  return {
    Host,
    SingleChoiceSegmentedButtonRow,
    MultiChoiceSegmentedButtonRow,
    SegmentedButton,
    TriStateCheckbox,
    Switch,
    Button: ComposeButton,
    FilledTonalButton,
    OutlinedButton,
    ElevatedButton,
    TextButton,
    AssistChip,
    FilterChip,
    CircularProgressIndicator,
    ExposedDropdownMenuBox,
    ExposedDropdownMenu,
    DropdownMenuItem,
    TextField,
    OutlinedTextField,
    Text: ComposeText,
    useNativeState,
    useMaterialColors: jest.fn(() => ({})),
    getMaterialColors: jest.fn(() => ({})),
    isDynamicColorAvailable: false,
  };
});

jest.mock('@expo/ui/jetpack-compose/modifiers', () => ({
  menuAnchor: jest.fn(() => ({ type: 'menuAnchor' })),
}));
