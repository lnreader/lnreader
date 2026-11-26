import { fireEvent, render, screen } from '@testing-library/react-native';
import Color from 'color';
import { StyleSheet } from 'react-native';

import { defaultCover } from '@plugins/helpers/constants';
import type { ThemeColors } from '@theme/types';
import NovelCoverImage, { isMissingNovelCover } from '../NovelCoverImage';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const theme = {
  isDark: false,
  background: '#EDE2FF',
  onSurfaceVariant: '#4A454E',
  surfaceContainerHigh: '#E8E8E8',
  surfaceVariant: '#E9DFEB',
} as ThemeColors;

const darkTheme = {
  ...theme,
  isDark: true,
  background: '#111129',
  onSurfaceVariant: '#CCC4CE',
  surfaceContainerHigh: '#302D36',
} as ThemeColors;

const expectPlaceholder = (background: string, iconColor: string) => {
  const cover = screen.getByTestId('novel-cover');
  const fill = Color(StyleSheet.flatten(cover.props.style).backgroundColor);

  expect(fill.contrast(Color(background))).toBeGreaterThanOrEqual(1.35);
  expect(fill.contrast(Color(iconColor))).toBeGreaterThanOrEqual(4.5);
  expect(cover.props.children.props.color).toBe(iconColor);
};

describe('NovelCoverImage', () => {
  it('identifies empty and legacy fallback covers as missing', () => {
    expect(isMissingNovelCover(undefined)).toBe(true);
    expect(isMissingNovelCover('')).toBe(true);
    expect(isMissingNovelCover(defaultCover)).toBe(true);
    expect(isMissingNovelCover('https://example.com/cover.webp')).toBe(false);
  });

  it('shows the light placeholder when a cover is missing', () => {
    render(
      <NovelCoverImage testID="novel-cover" theme={theme} uri={undefined} />,
    );

    expect(screen.getByTestId('novel-cover').props.source).toBeUndefined();
    expectPlaceholder(theme.background, theme.onSurfaceVariant);
  });

  it('shows the dark placeholder when loading fails in dark mode', () => {
    render(
      <NovelCoverImage
        testID="novel-cover"
        theme={darkTheme}
        uri="https://example.com/broken.webp"
      />,
    );

    expect(screen.getByTestId('novel-cover').props.source).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uri: 'https://example.com/broken.webp',
        }),
      ]),
    );
    expect(screen.getByTestId('novel-cover')).toHaveStyle({
      backgroundColor: darkTheme.surfaceContainerHigh,
    });

    fireEvent(screen.getByTestId('novel-cover'), 'error', {
      nativeEvent: { error: 'Failed to load image' },
    });

    expect(screen.getByTestId('novel-cover').props.source).toBeUndefined();
    expectPlaceholder(darkTheme.background, darkTheme.onSurfaceVariant);
  });

  it('preserves request bodies through the React Native compatibility path', () => {
    render(
      <NovelCoverImage
        requestInit={{
          body: 'token=secret',
          headers: { Referer: 'https://example.com' },
          method: 'POST',
        }}
        testID="novel-cover"
        theme={theme}
        uri="https://example.com/cover"
      />,
    );

    expect(screen.getByTestId('novel-cover').props.source).toEqual({
      body: 'token=secret',
      headers: { Referer: 'https://example.com' },
      method: 'POST',
      uri: 'https://example.com/cover',
    });
    expect(screen.getByTestId('novel-cover')).toHaveStyle({
      backgroundColor: theme.surfaceContainerHigh,
    });
  });
});
