import { render, screen } from '@testing-library/react-native';
import type { ThemeColors } from '@theme/types';
import { NovelGenres } from '../NovelInfoComponents';

jest.mock('../../../../../components', () => {
  const { Text } = require('react-native');

  return {
    Chip: ({ label }: { label: string }) => <Text>{label}</Text>,
    NovelCoverImage: () => null,
  };
});

const theme = {} as ThemeColors;

describe('NovelGenres', () => {
  it('renders normalized genres', () => {
    render(
      <NovelGenres theme={theme} genres="Fantasy,  Adventure, , Romance " />,
    );

    expect(screen.getByText('Fantasy')).toBeTruthy();
    expect(screen.getByText('Adventure')).toBeTruthy();
    expect(screen.getByText('Romance')).toBeTruthy();
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['malformed', ['Fantasy'] as unknown as string],
  ])('does not crash for %s genres', (_case, genres) => {
    expect(() =>
      render(<NovelGenres theme={theme} genres={genres} />),
    ).not.toThrow();
  });
});
