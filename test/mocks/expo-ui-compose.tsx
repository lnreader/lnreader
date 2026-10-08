// Compose views only exist on device; each renders the closest React Native
// primitive so testing-library queries stay meaningful.
import React, { createContext, useContext, useImperativeHandle } from 'react';
import {
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type ViewProps,
} from 'react-native';

type ModifierLike = {
  $type: string;
  eventListener?: (args?: unknown) => void;
  [key: string]: unknown;
};

type WithModifiers = { modifiers?: ModifierLike[]; children?: React.ReactNode };

const findModifier = (modifiers: ModifierLike[] | undefined, type: string) =>
  modifiers?.find(m => m.$type === type);

const testIdOf = (modifiers?: ModifierLike[]) =>
  findModifier(modifiers, 'testID')?.testID as string | undefined;

const withInteraction = (
  modifiers: ModifierLike[] | undefined,
  element: React.ReactElement<ViewProps>,
  testID?: string,
) => {
  const click = findModifier(modifiers, 'clickable');
  const combined = findModifier(modifiers, 'combinedClickable');
  const toggle =
    findModifier(modifiers, 'toggleable') ??
    findModifier(modifiers, 'selectable');
  const id = testID ?? testIdOf(modifiers);
  if (!click && !combined && !toggle) {
    return id ? React.cloneElement(element, { testID: id }) : element;
  }
  const role = toggle?.role as string | undefined;
  return (
    <Pressable
      testID={id}
      accessibilityRole={
        role === 'radioButton'
          ? 'radio'
          : role === 'checkbox' || role === 'switch' || role === 'tab'
          ? role
          : 'button'
      }
      accessibilityState={
        toggle
          ? {
              checked: (toggle.value ?? toggle.selected) as boolean | undefined,
            }
          : undefined
      }
      onPress={() => {
        click?.eventListener?.();
        combined?.eventListener?.({ event: 'click' });
        toggle?.eventListener?.();
      }}
      onLongPress={
        combined
          ? () => combined.eventListener?.({ event: 'longClick' })
          : undefined
      }
    >
      {element}
    </Pressable>
  );
};

const container =
  (name: string) =>
  ({ modifiers, children }: WithModifiers) =>
    withInteraction(
      modifiers,
      <View accessibilityLabel={undefined} testID={undefined}>
        {children}
      </View>,
    );

const slot =
  (name: string) =>
  ({ children }: { children?: React.ReactNode }) =>
    (
      <View testID={undefined} accessibilityHint={name}>
        {children}
      </View>
    );

export const Host = ({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: ViewProps['style'];
}) => <View style={style}>{children}</View>;

export const Text = ({
  children,
  modifiers,
  maxLines,
  color,
}: {
  children?: React.ReactNode;
  modifiers?: ModifierLike[];
  maxLines?: number;
  color?: string;
}) =>
  withInteraction(
    modifiers,
    <RNText numberOfLines={maxLines} style={color ? { color } : undefined}>
      {children}
    </RNText>,
  );

const button =
  (role: 'button' | 'link' = 'button') =>
  ({
    onClick,
    enabled = true,
    children,
    modifiers,
  }: {
    onClick?: () => void;
    enabled?: boolean;
    children?: React.ReactNode;
    modifiers?: ModifierLike[];
  }) =>
    (
      <Pressable
        testID={testIdOf(modifiers)}
        accessibilityRole={role}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPress={onClick}
      >
        {children}
      </Pressable>
    );

export const Button = button();
export const FilledTonalButton = button();
export const OutlinedButton = button();
export const ElevatedButton = button();
export const TextButton = button();
export const IconButton = button();
export const FilledIconButton = button();
export const FilledTonalIconButton = button();
export const OutlinedIconButton = button();

const toggleButton = ({
  checked,
  onCheckedChange,
  enabled = true,
  children,
  modifiers,
}: {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  enabled?: boolean;
  children?: React.ReactNode;
  modifiers?: ModifierLike[];
}) => (
  <Pressable
    testID={testIdOf(modifiers)}
    accessibilityRole="togglebutton"
    accessibilityState={{ checked, disabled: !enabled }}
    disabled={!enabled}
    onPress={() => onCheckedChange?.(!checked)}
  >
    {children}
  </Pressable>
);
export const ToggleButton = toggleButton;
export const IconToggleButton = toggleButton;
export const FilledIconToggleButton = toggleButton;
export const OutlinedIconToggleButton = toggleButton;

const fab = ({
  onClick,
  children,
  modifiers,
}: {
  onClick?: () => void;
  children?: React.ReactNode;
  modifiers?: ModifierLike[];
}) => (
  <Pressable
    testID={testIdOf(modifiers)}
    accessibilityRole="button"
    onPress={onClick}
  >
    {children}
  </Pressable>
);
const withFabSlots = (component: typeof fab) =>
  Object.assign(component, { Icon: slot('fab-icon'), Text: slot('fab-text') });
export const FloatingActionButton = withFabSlots(fab);
export const SmallFloatingActionButton = withFabSlots(
  (props: Parameters<typeof fab>[0]) => fab(props),
);
export const LargeFloatingActionButton = withFabSlots(
  (props: Parameters<typeof fab>[0]) => fab(props),
);
export const ExtendedFloatingActionButton = withFabSlots(
  (props: Parameters<typeof fab>[0]) => fab(props),
);

const checkable =
  (role: 'switch' | 'checkbox') =>
  ({
    value,
    onCheckedChange,
    enabled = true,
    modifiers,
  }: {
    value: boolean;
    onCheckedChange?: (value: boolean) => void;
    enabled?: boolean;
    modifiers?: ModifierLike[];
  }) =>
    (
      <Pressable
        testID={testIdOf(modifiers)}
        accessibilityRole={role}
        accessibilityState={{ checked: value, disabled: !enabled }}
        disabled={!enabled}
        onPress={() => onCheckedChange?.(!value)}
      />
    );
export const Switch = Object.assign(checkable('switch'), {
  ThumbContent: slot('thumb'),
  DefaultIconSize: 16,
});
export const Checkbox = checkable('checkbox');
export const TriStateCheckbox = ({
  state,
  onClick,
  enabled = true,
  modifiers,
}: {
  state: 'on' | 'off' | 'indeterminate';
  onClick?: () => void;
  enabled?: boolean;
  modifiers?: ModifierLike[];
}) => (
  <Pressable
    testID={testIdOf(modifiers)}
    accessibilityRole="checkbox"
    accessibilityState={{
      checked: state === 'indeterminate' ? 'mixed' : state === 'on',
      disabled: !enabled,
    }}
    disabled={!enabled}
    onPress={onClick}
  />
);
export const RadioButton = ({
  selected,
  onClick,
  enabled = true,
  modifiers,
}: {
  selected: boolean;
  onClick?: () => void;
  enabled?: boolean;
  modifiers?: ModifierLike[];
}) => (
  <Pressable
    testID={testIdOf(modifiers)}
    accessibilityRole="radio"
    accessibilityState={{ checked: selected, disabled: !enabled }}
    disabled={!enabled}
    onPress={onClick}
  />
);

export const Slider = Object.assign(
  ({
    value = 0,
    min = 0,
    max = 1,
    enabled = true,
    onValueChange,
    onValueChangeFinished,
    modifiers,
  }: {
    value?: number;
    min?: number;
    max?: number;
    enabled?: boolean;
    onValueChange?: (value: number) => void;
    onValueChangeFinished?: () => void;
    modifiers?: ModifierLike[];
  }) => (
    <View
      testID={testIdOf(modifiers)}
      accessible
      accessibilityRole="adjustable"
      accessibilityState={{ disabled: !enabled }}
      accessibilityValue={{ min, max, now: value }}
      // Tests drive the slider with fireEvent(el, 'valueChange', v).
      {...({
        onValueChange: (next: number) => {
          if (!enabled) {
            return;
          }
          onValueChange?.(next);
          onValueChangeFinished?.();
        },
      } as object)}
    />
  ),
  { Thumb: slot('thumb'), Track: slot('track') },
);
export const VerticalSlider = Slider;

type ObservableState<T> = {
  value: T;
  get(): T;
  set(value: T): void;
  onChange: ((value: T) => void) | null;
};

export const useNativeState = <T,>(initialValue: T): ObservableState<T> => {
  const [state] = React.useState(() => {
    const holder: ObservableState<T> = {
      value: initialValue,
      get: () => holder.value,
      set: (next: T) => {
        holder.value = next;
        holder.onChange?.(next);
      },
      onChange: null,
    };
    return holder;
  });
  return state;
};

type TextFieldHandle = {
  setText: (text: string) => Promise<void>;
  clear: () => Promise<void>;
  focus: () => Promise<void>;
  blur: () => Promise<void>;
  setSelection: (start: number, end: number) => Promise<void>;
};

const TextFieldSlots = {
  Label: slot('label'),
  Placeholder: slot('placeholder'),
  LeadingIcon: slot('leading'),
  TrailingIcon: slot('trailing'),
  Prefix: slot('prefix'),
  Suffix: slot('suffix'),
  SupportingText: slot('supporting'),
};

const textField = React.forwardRef<
  TextFieldHandle,
  {
    value?: ObservableState<string>;
    onValueChange?: (value: string) => void;
    onFocusChanged?: (focused: boolean) => void;
    keyboardActions?: Record<string, ((value: string) => void) | undefined>;
    enabled?: boolean;
    readOnly?: boolean;
    singleLine?: boolean;
    visualTransformation?: 'password' | 'none';
    modifiers?: ModifierLike[];
    children?: React.ReactNode;
  }
>(
  (
    {
      value,
      onValueChange,
      onFocusChanged,
      keyboardActions,
      enabled = true,
      readOnly,
      singleLine,
      visualTransformation,
      modifiers,
      children,
    },
    ref,
  ) => {
    const [text, setText] = React.useState(value?.get() ?? '');
    const update = (next: string) => {
      setText(next);
      value?.set(next);
      onValueChange?.(next);
    };
    useImperativeHandle(ref, () => ({
      setText: async (next: string) => update(next),
      clear: async () => update(''),
      focus: async () => onFocusChanged?.(true),
      blur: async () => onFocusChanged?.(false),
      setSelection: async () => undefined,
    }));
    const submit = () => {
      const action = Object.values(keyboardActions ?? {}).find(Boolean);
      action?.(text);
    };
    return (
      <View>
        {children}
        <TextInput
          testID={testIdOf(modifiers)}
          value={text}
          editable={enabled && !readOnly}
          multiline={!singleLine}
          secureTextEntry={visualTransformation === 'password'}
          onChangeText={update}
          onFocus={() => onFocusChanged?.(true)}
          onBlur={() => onFocusChanged?.(false)}
          onSubmitEditing={submit}
        />
      </View>
    );
  },
);
export const TextField = Object.assign(textField, TextFieldSlots);
export const OutlinedTextField = Object.assign(
  React.forwardRef<TextFieldHandle, React.ComponentProps<typeof textField>>(
    (props, ref) => React.createElement(textField, { ...props, ref }),
  ),
  TextFieldSlots,
);
export const BasicTextField = Object.assign(
  React.forwardRef<TextFieldHandle, React.ComponentProps<typeof textField>>(
    (props, ref) => React.createElement(textField, { ...props, ref }),
  ),
  {
    DecorationBox: slot('decoration'),
    InnerTextField: () => null,
    Placeholder: slot('placeholder'),
  },
);

export const Column = container('Column');
export const Row = container('Row');
export const Box = container('Box');
export const FlowRow = container('FlowRow');
export const LazyColumn = container('LazyColumn');
export const LazyRow = container('LazyRow');
export const HorizontalMultiBrowseCarousel = container('Carousel');
export const HorizontalUncontainedCarousel = container('Carousel');
export const HorizontalCenteredHeroCarousel = container('Carousel');
export const Spacer = () => <View />;
export const HorizontalDivider = () => <View accessibilityRole="none" />;
export const VerticalDivider = HorizontalDivider;

export const Card = container('Card');
export const ElevatedCard = container('ElevatedCard');
export const OutlinedCard = container('OutlinedCard');

export const Surface = ({
  onClick,
  onCheckedChange,
  checked,
  selected,
  modifiers,
  children,
}: {
  onClick?: () => void;
  onCheckedChange?: (checked: boolean) => void;
  checked?: boolean;
  selected?: boolean;
  modifiers?: ModifierLike[];
  children?: React.ReactNode;
}) => {
  const content = withInteraction(modifiers, <View>{children}</View>);
  if (!onClick && !onCheckedChange) return content;
  return (
    <Pressable
      testID={testIdOf(modifiers)}
      accessibilityRole="button"
      accessibilityState={{ checked, selected }}
      onPress={() =>
        onCheckedChange ? onCheckedChange(!checked) : onClick?.()
      }
    >
      {content}
    </Pressable>
  );
};

export const ListItem = Object.assign(container('ListItem'), {
  HeadlineContent: slot('headline'),
  OverlineContent: slot('overline'),
  SupportingContent: slot('supporting'),
  LeadingContent: slot('leading'),
  TrailingContent: slot('trailing'),
});

export const Icon = ({
  contentDescription,
  modifiers,
}: {
  contentDescription?: string;
  modifiers?: ModifierLike[];
}) => (
  <View
    testID={testIdOf(modifiers)}
    accessibilityRole="image"
    accessibilityLabel={contentDescription}
  />
);

export const Image = ({
  source,
  contentDescription,
  onError,
  onLoad,
  modifiers,
}: {
  source: number | { uri: string };
  contentDescription?: string | null;
  onError?: (error: string) => void;
  onLoad?: () => void;
  modifiers?: ModifierLike[];
}) =>
  withInteraction(
    modifiers,
    <View
      accessibilityRole="image"
      accessibilityLabel={contentDescription ?? undefined}
      {...({
        source,
        onError,
        onLoad,
      } as object)}
    />,
  );

const chipSlots = {
  Label: slot('label'),
  LeadingIcon: slot('leading'),
  TrailingIcon: slot('trailing'),
  Avatar: slot('avatar'),
  Icon: slot('icon'),
};
const chip = ({
  onClick,
  selected,
  enabled = true,
  modifiers,
  children,
}: {
  onClick?: () => void;
  selected?: boolean;
  enabled?: boolean;
  modifiers?: ModifierLike[];
  children?: React.ReactNode;
}) => (
  <Pressable
    testID={testIdOf(modifiers)}
    accessibilityRole="button"
    accessibilityState={{ selected, disabled: !enabled }}
    disabled={!enabled}
    onPress={onClick}
  >
    {children}
  </Pressable>
);
export const AssistChip = Object.assign(
  (props: Parameters<typeof chip>[0]) => chip(props),
  chipSlots,
);
export const FilterChip = Object.assign(
  (props: Parameters<typeof chip>[0]) => chip(props),
  chipSlots,
);
export const InputChip = Object.assign(
  (props: Parameters<typeof chip>[0]) => chip(props),
  chipSlots,
);
export const SuggestionChip = Object.assign(
  (props: Parameters<typeof chip>[0]) => chip(props),
  chipSlots,
);

export const SegmentedButton = Object.assign(
  ({
    selected,
    checked,
    onClick,
    onCheckedChange,
    enabled = true,
    modifiers,
    children,
  }: {
    selected?: boolean;
    checked?: boolean;
    onClick?: () => void;
    onCheckedChange?: (checked: boolean) => void;
    enabled?: boolean;
    modifiers?: ModifierLike[];
    children?: React.ReactNode;
  }) => (
    <Pressable
      testID={testIdOf(modifiers)}
      accessibilityRole="button"
      accessibilityState={{ selected: selected ?? checked, disabled: !enabled }}
      disabled={!enabled}
      onPress={() =>
        onCheckedChange ? onCheckedChange(!checked) : onClick?.()
      }
    >
      {children}
    </Pressable>
  ),
  { Label: slot('label') },
);
export const SingleChoiceSegmentedButtonRow = container('SegmentedRow');
export const MultiChoiceSegmentedButtonRow = container('SegmentedRow');

export const Badge = ({ children }: { children?: React.ReactNode }) => (
  <View>{children}</View>
);
export const BadgedBox = Object.assign(container('BadgedBox'), {
  Badge: slot('badge'),
});

export const LinearProgressIndicator = ({
  progress,
}: {
  progress?: number | null;
}) => (
  <View
    accessibilityRole="progressbar"
    accessibilityValue={
      progress == null ? undefined : { min: 0, max: 1, now: progress }
    }
  />
);
export const CircularProgressIndicator = LinearProgressIndicator;
export const LinearWavyProgressIndicator = LinearProgressIndicator;
export const CircularWavyProgressIndicator = LinearProgressIndicator;
export const LoadingIndicator = () => <View accessibilityRole="progressbar" />;
export const ContainedLoadingIndicator = LoadingIndicator;

export const AlertDialog = Object.assign(
  ({
    children,
    modifiers,
  }: {
    children?: React.ReactNode;
    onDismissRequest?: () => void;
    modifiers?: ModifierLike[];
  }) => (
    <View testID={testIdOf(modifiers)} accessibilityViewIsModal>
      {children}
    </View>
  ),
  {
    Title: slot('title'),
    Text: slot('text'),
    ConfirmButton: slot('confirm'),
    DismissButton: slot('dismiss'),
    Icon: slot('icon'),
  },
);
export const BasicAlertDialog = ({
  children,
  modifiers,
  onDismissRequest,
}: {
  children?: React.ReactNode;
  onDismissRequest?: () => void;
  modifiers?: ModifierLike[];
}) => (
  <View testID={testIdOf(modifiers)} accessibilityViewIsModal>
    {/* Stands in for the dialog window's outside-tap dismissal. */}
    <Pressable testID="dialog-backdrop" onPress={onDismissRequest} />
    {children}
  </View>
);

type SheetHandle = {
  hide: () => Promise<void>;
  expand: () => Promise<void>;
  partialExpand: () => Promise<void>;
};
export const ModalBottomSheet = Object.assign(
  React.forwardRef<
    SheetHandle,
    {
      children?: React.ReactNode;
      onDismissRequest: () => void;
      modifiers?: ModifierLike[];
    }
  >(({ children, onDismissRequest, modifiers }, ref) => {
    useImperativeHandle(ref, () => ({
      hide: async () => onDismissRequest(),
      expand: async () => undefined,
      partialExpand: async () => undefined,
    }));
    return (
      <View testID={testIdOf(modifiers)} accessibilityViewIsModal>
        {children}
      </View>
    );
  }),
  { DragHandle: slot('drag-handle') },
);

const MenuContext = createContext(false);
const menuPart =
  (visibleWhenCollapsed: boolean) =>
  ({ children }: { children?: React.ReactNode }) => {
    const expanded = useContext(MenuContext);
    return expanded || visibleWhenCollapsed ? <View>{children}</View> : null;
  };
export const DropdownMenu = Object.assign(
  ({
    expanded = false,
    children,
    onDismissRequest,
  }: {
    expanded?: boolean;
    children?: React.ReactNode;
    onDismissRequest?: () => void;
  }) => (
    <MenuContext.Provider value={expanded}>
      <View>
        {/* Stands in for the popup's outside-tap dismissal. */}
        {expanded ? (
          <Pressable testID="menu-backdrop" onPress={onDismissRequest} />
        ) : null}
        {children}
      </View>
    </MenuContext.Provider>
  ),
  {
    Trigger: menuPart(true),
    Preview: menuPart(true),
    Items: menuPart(false),
  },
);
export const DropdownMenuItem = Object.assign(
  ({
    onClick,
    enabled = true,
    modifiers,
    children,
  }: {
    onClick?: () => void;
    enabled?: boolean;
    modifiers?: ModifierLike[];
    children?: React.ReactNode;
  }) => (
    <Pressable
      testID={testIdOf(modifiers)}
      accessibilityRole="menuitem"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onClick}
    >
      {children}
    </Pressable>
  ),
  {
    Text: slot('text'),
    LeadingIcon: slot('leading'),
    TrailingIcon: slot('trailing'),
  },
);
export const ExposedDropdownMenuBox = ({
  expanded,
  children,
}: {
  expanded: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  children?: React.ReactNode;
}) => (
  <MenuContext.Provider value={expanded}>
    <View>{children}</View>
  </MenuContext.Provider>
);
export const ExposedDropdownMenu = ({
  expanded,
  children,
}: {
  expanded: boolean;
  children?: React.ReactNode;
}) => (expanded ? <View>{children}</View> : null);

export const NavigationBar = container('NavigationBar');
export const NavigationBarItem = Object.assign(
  ({
    selected,
    onClick,
    modifiers,
    children,
  }: {
    selected: boolean;
    onClick?: () => void;
    modifiers?: ModifierLike[];
    children?: React.ReactNode;
  }) => (
    <Pressable
      testID={testIdOf(modifiers)}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onClick}
    >
      {children}
    </Pressable>
  ),
  {
    Icon: slot('icon'),
    SelectedIcon: menuPart(false),
    Label: slot('label'),
  },
);

export const HorizontalFloatingToolbar = Object.assign(container('Toolbar'), {
  FloatingActionButton: ({
    onPress,
    children,
  }: {
    onPress?: () => void;
    children?: React.ReactNode;
  }) => (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {children}
    </Pressable>
  ),
});

export const PullToRefreshBox = ({
  children,
  modifiers,
  onRefresh,
}: {
  children?: React.ReactNode;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  modifiers?: ModifierLike[];
}) => (
  <View testID={testIdOf(modifiers)} {...({ onRefresh } as object)}>
    {children}
  </View>
);

export const HorizontalPager = React.forwardRef<
  {
    animateScrollToPage: (page: number) => Promise<void>;
    scrollToPage: (page: number) => Promise<void>;
  },
  {
    children?: React.ReactNode;
    initialPage?: number;
    onSettledPageChange?: (page: number) => void;
    onCurrentPageChange?: (page: number) => void;
    modifiers?: ModifierLike[];
  }
>(({ children, onSettledPageChange, onCurrentPageChange, modifiers }, ref) => {
  useImperativeHandle(ref, () => ({
    animateScrollToPage: async (page: number) => {
      onCurrentPageChange?.(page);
      onSettledPageChange?.(page);
    },
    scrollToPage: async (page: number) => {
      onCurrentPageChange?.(page);
      onSettledPageChange?.(page);
    },
  }));
  return <View testID={testIdOf(modifiers)}>{children}</View>;
});

export const SearchBar = Object.assign(container('SearchBar'), {
  Placeholder: slot('placeholder'),
  ExpandedFullScreenSearchBar: slot('expanded'),
});
export const DockedSearchBar = Object.assign(container('DockedSearchBar'), {
  Placeholder: slot('placeholder'),
  LeadingIcon: slot('leading'),
});

export const Snackbar = () => null;
export const SnackbarHost = React.forwardRef<
  { showSnackbar: (options: { message: string }) => Promise<string> },
  { children?: React.ReactNode }
>((_props, ref) => {
  useImperativeHandle(ref, () => ({
    showSnackbar: async () => 'dismissed',
  }));
  return null;
});

export const TooltipBox = Object.assign(container('TooltipBox'), {
  PlainTooltip: () => null,
  RichTooltip: Object.assign(() => null, {
    Title: slot('title'),
    Text: slot('text'),
    Action: slot('action'),
  }),
});

export const AnimatedVisibility = ({
  visible,
  children,
}: {
  visible: boolean;
  children?: React.ReactNode;
}) => (visible ? <View>{children}</View> : null);
const transition = () => {
  const t = { plus: () => t };
  return t;
};
export const EnterTransition = {
  fadeIn: transition,
  slideInHorizontally: transition,
  slideInVertically: transition,
  expandIn: transition,
  expandHorizontally: transition,
  expandVertically: transition,
  scaleIn: transition,
};
export const ExitTransition = {
  fadeOut: transition,
  slideOutHorizontally: transition,
  slideOutVertically: transition,
  shrinkOut: transition,
  shrinkHorizontally: transition,
  shrinkVertically: transition,
  scaleOut: transition,
};

export const RNHostView = ({ children }: { children: React.ReactElement }) =>
  children;

export const DateTimePicker = () => <View />;
export const DateRangePicker = () => <View />;
export const DatePickerDialog = () => <View />;
export const DateRangePickerDialog = () => <View />;
export const TimePickerDialog = () => <View />;

const shapeElement = () => null;
export const Shape = {
  Star: shapeElement,
  PillStar: shapeElement,
  Pill: shapeElement,
  Circle: shapeElement,
  Rectangle: shapeElement,
  Polygon: shapeElement,
  RoundedCorner: shapeElement,
};

const palettes = (
  global as unknown as {
    mockMaterialPalettes: Record<'light' | 'dark', Record<string, string>>;
  }
).mockMaterialPalettes;

export const isDynamicColorAvailable = false;
export const getMaterialColors = (options?: {
  scheme?: 'light' | 'dark';
  seedColor?: string;
}) => {
  const palette = {
    ...palettes[options?.scheme === 'dark' ? 'dark' : 'light'],
  };
  if (typeof options?.seedColor === 'string') {
    palette.primary = options.seedColor;
  }
  return palette;
};
export const useMaterialColors = (options?: {
  colorScheme?: 'light' | 'dark' | null;
  seedColor?: string;
}) =>
  getMaterialColors({
    scheme: options?.colorScheme === 'dark' ? 'dark' : 'light',
    seedColor: options?.seedColor,
  });
export const HostPaletteContext = createContext(null);
