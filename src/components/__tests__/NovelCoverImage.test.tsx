import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import NativeFile from '@modules/native-file';

import { defaultCover } from '@plugins/helpers/constants';
import type { ThemeColors } from '@theme/types';
import NovelCoverImage, { isMissingNovelCover } from '../NovelCoverImage';

const theme = {
  onSurfaceVariant: '#404040',
  outline: '#707070',
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
      <NovelCoverImage
        testID="novel-cover"
        theme={theme}
        uri={undefined}
        height={80}
      />,
    );

    expect(screen.getByTestId('novel-cover')).toBeTruthy();
    expect(screen.getByTestId('novel-cover').props.source).toBeUndefined();
  });

  it('replaces a cover with the placeholder when loading fails', () => {
    render(
      <NovelCoverImage
        testID="novel-cover"
        theme={theme}
        uri="https://example.com/broken.webp"
        height={80}
      />,
    );

    expect(screen.getByTestId('novel-cover').props.source).toEqual({
      uri: 'https://example.com/broken.webp',
    });

    fireEvent(screen.getByTestId('novel-cover'), 'error', 'Failed to load');

    expect(screen.getByTestId('novel-cover').props.source).toBeUndefined();
  });

  it('preserves request bodies when the cover needs the plugin request', async () => {
    (NativeFile.exists as jest.Mock).mockReturnValueOnce(false);
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
        height={80}
      />,
    );

    await waitFor(() =>
      expect(NativeFile.downloadFile).toHaveBeenCalledWith(
        'https://example.com/cover',
        expect.any(String),
        'POST',
        { Referer: 'https://example.com' },
        'token=secret',
      ),
    );
  });
});
