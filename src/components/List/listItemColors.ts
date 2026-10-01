import type { ThemeColors } from '@theme/types';

export const listItemColors = (theme: ThemeColors) => ({
  containerColor: 'transparent',
  contentColor: theme.onSurface,
  supportingContentColor: theme.onSurfaceVariant,
  overlineContentColor: theme.onSurfaceVariant,
  leadingContentColor: theme.onSurfaceVariant,
  trailingContentColor: theme.onSurfaceVariant,
});
