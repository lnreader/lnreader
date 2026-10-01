import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  align,
  background,
  clickable,
  clip,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  size,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import { addComputedColors } from '@hooks/persisted/useTheme';
import type { ThemeColors } from '@theme/types';
import CheckIcon from '@expo/material-symbols/check.xml';
import { AppIcon, AppText, OutlinedBox } from '@components';

const CARD_WIDTH = 116;
const CARD_HEIGHT = 196;

interface ThemePickerProps {
  theme: ThemeColors;
  currentTheme: ThemeColors;
  onPress: () => void;
}

export const ThemePicker = ({
  theme: previewTheme,
  currentTheme: theme,
  onPress,
}: ThemePickerProps) => {
  // The preview also shows the surfaces the app derives for the theme.
  const preview = addComputedColors(previewTheme);
  const selected = theme.id === previewTheme.id;
  const bar = (share: number, color: string) => (
    <Box
      modifiers={[
        width(Math.round((CARD_WIDTH - 24) * share)),
        height(8),
        clip(Shapes.RoundedCorner(4)),
        background(color),
      ]}
    />
  );
  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement={{ spacedBy: 8 }}
      modifiers={[width(CARD_WIDTH), clickable(onPress, { indication: false })]}
    >
      <OutlinedBox
        shape={20}
        outlineWidth={selected ? 3 : 1}
        outlineColor={selected ? theme.primary : theme.outlineVariant}
        color={preview.background}
        modifiers={[width(CARD_WIDTH), height(CARD_HEIGHT)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 8 }}
          modifiers={[fillMaxWidth(), padding(12, 14, 12, 12)]}
        >
          {bar(0.7, preview.onSurface)}
          <Row
            horizontalArrangement={{ spacedBy: 6 }}
            modifiers={[fillMaxWidth()]}
          >
            <Box
              modifiers={[
                weight(1),
                height(64),
                clip(Shapes.RoundedCorner(10)),
                background(preview.surfaceContainerHigh),
              ]}
            />
            <Box
              modifiers={[
                weight(1),
                height(64),
                clip(Shapes.RoundedCorner(10)),
                background(preview.secondaryContainer),
              ]}
            />
          </Row>
          {bar(0.9, preview.onSurfaceVariant)}
          {bar(0.5, preview.onSurfaceVariant)}
        </Column>
        <Box
          modifiers={[
            align('bottomCenter'),
            fillMaxWidth(),
            height(36),
            background(preview.surfaceContainer),
          ]}
        >
          <Row
            verticalAlignment="center"
            horizontalArrangement="spaceEvenly"
            modifiers={[fillMaxWidth(), padding(0, 12, 0, 0)]}
          >
            <Box
              modifiers={[
                size(24, 12),
                clip(Shapes.RoundedCorner(6)),
                background(preview.secondaryContainer),
              ]}
            />
            <Box
              modifiers={[
                size(12, 12),
                clip(Shapes.Circle),
                background(preview.outline),
              ]}
            />
            <Box
              modifiers={[
                size(12, 12),
                clip(Shapes.Circle),
                background(preview.outline),
              ]}
            />
          </Row>
        </Box>
        <Box
          contentAlignment="center"
          modifiers={[align('bottomEnd'), padding(0, 0, 10, 46)]}
        >
          <Box
            contentAlignment="center"
            modifiers={[
              size(28, 28),
              clip(Shapes.RoundedCorner(8)),
              background(preview.primary),
            ]}
          >
            {selected ? (
              <AppIcon source={CheckIcon} size={18} tint={preview.onPrimary} />
            ) : null}
          </Box>
        </Box>
      </OutlinedBox>
      <AppText
        variant="labelMedium"
        align="center"
        maxLines={1}
        color={selected ? theme.primary : theme.onSurface}
      >
        {preview.name}
      </AppText>
    </Column>
  );
};
