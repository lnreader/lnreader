import type { MaterialDesignIconName } from '@type/icon';
import type { ThemeColors } from '@theme/types';
import type { PluginIssueCategory } from '@plugins/issueIndex';

type PluginIssuePresentation = {
  labelKey:
    | 'domainChanged'
    | 'cantLoadNovels'
    | 'missingImages'
    | 'missingChapter'
    | 'wrongContent'
    | 'wrongFormatting'
    | 'other';
  iconName: MaterialDesignIconName;
  colorKey: keyof ThemeColors;
};

export const pluginIssuePresentation: Record<
  PluginIssueCategory,
  PluginIssuePresentation
> = {
  6: { labelKey: 'domainChanged', iconName: 'web-off', colorKey: 'error' },
  5: {
    labelKey: 'cantLoadNovels',
    iconName: 'book-off-outline',
    colorKey: 'error',
  },
  4: {
    labelKey: 'missingImages',
    iconName: 'image-off-outline',
    colorKey: 'tertiary',
  },
  3: {
    labelKey: 'missingChapter',
    iconName: 'book-minus-outline',
    colorKey: 'tertiary',
  },
  2: {
    labelKey: 'wrongContent',
    iconName: 'file-document-alert-outline',
    colorKey: 'primary',
  },
  1: {
    labelKey: 'wrongFormatting',
    iconName: 'format-text',
    colorKey: 'primary',
  },
  0: {
    labelKey: 'other',
    iconName: 'information-outline',
    colorKey: 'onSurfaceVariant',
  },
};
