import { type ReactNode } from 'react';
import { type ColorValue } from 'react-native';
import { Box, type BoxProps } from '@expo/ui/jetpack-compose';
import {
  background,
  clickable,
  clip,
  fillMaxSize,
  paddingAll,
  Shapes,
  type ModifierConfig,
} from '@expo/ui/jetpack-compose/modifiers';

export interface OutlinedBoxProps {
  shape: number | 'circle';
  outlineWidth: number;
  outlineColor: ColorValue;
  color?: ColorValue;
  onPress?: () => void;
  modifiers?: ModifierConfig[];
  contentAlignment?: BoxProps['contentAlignment'];
  children?: ReactNode;
}

// expo-ui's `border` always strokes a rectangle, which a rounded clip cuts
// at the corners, so the outline is painted as an outer layer instead.
const OutlinedBox = ({
  shape,
  outlineWidth,
  outlineColor,
  color,
  onPress,
  modifiers = [],
  contentAlignment,
  children,
}: OutlinedBoxProps) => {
  const outer =
    shape === 'circle' ? Shapes.Circle : Shapes.RoundedCorner(shape);
  const inner =
    shape === 'circle'
      ? Shapes.Circle
      : Shapes.RoundedCorner(Math.max(0, shape - outlineWidth));
  return (
    <Box
      modifiers={[
        ...modifiers,
        clip(outer),
        background(outlineColor),
        ...(onPress ? [clickable(onPress)] : []),
        paddingAll(outlineWidth),
      ]}
    >
      <Box
        contentAlignment={contentAlignment}
        modifiers={[
          fillMaxSize(),
          clip(inner),
          ...(color === undefined ? [] : [background(color)]),
        ]}
      >
        {children}
      </Box>
    </Box>
  );
};

export default OutlinedBox;
