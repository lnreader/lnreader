import { fireEvent, render, screen } from '@testing-library/react-native';

import { defaultCover } from '@plugins/helpers/constants';
import type { ThemeColors } from '@theme/types';
import NovelCoverImage, { isMissingNovelCover } from '../NovelCoverImage';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const theme = {
  onSurfaceVariant: '#404040',
  surfaceVariant: '#d0d0d0',
} as ThemeColors;

describe('NovelCoverImage', () => {
  it('identifies empty and legacy fallback covers as missing', () => {
    expect(isMissingNovelCover(undefined)).toBe(true);
    expect(isMissingNovelCover('')).toBe(true);
    expect(isMissingNovelCover(defaultCover)).toBe(true);
    expect(isMissingNovelCover('https://example.com/cover.webp')).toBe(false);
  });

  it('shows the themed placeholder when a cover is missing', () => {
    render(
      <NovelCoverImage testID="novel-cover" theme={theme} uri={undefined} />,
    );

    expect(screen.getByTestId('novel-cover')).toHaveStyle({
      backgroundColor: theme.surfaceVariant,
    });
    expect(screen.getByTestId('novel-cover').props.source).toBeUndefined();
  });

  it('replaces a cover with the placeholder when loading fails', () => {
    render(
      <NovelCoverImage
        testID="novel-cover"
        theme={theme}
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

    fireEvent(screen.getByTestId('novel-cover'), 'error', {
      nativeEvent: { error: 'Failed to load image' },
    });

    expect(screen.getByTestId('novel-cover')).toHaveStyle({
      backgroundColor: theme.surfaceVariant,
    });
    expect(screen.getByTestId('novel-cover').props.source).toBeUndefined();
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
  });
});
