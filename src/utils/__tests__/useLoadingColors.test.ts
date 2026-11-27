import { ThemeColors } from '@theme/types';
import { getLoadingColors } from '../useLoadingColors';

jest.mock('@hooks/persisted', () => ({
  useAppSettings: jest.fn(),
}));

const createTheme = (surface: string, onSurface: string) =>
  ({ surface, onSurface } as ThemeColors);

describe('getLoadingColors', () => {
  it.each([
    [
      'light',
      createTheme('rgb(254, 251, 255)', 'rgb(27, 27, 31)'),
      ['#F0EEF2', '#F7F4F8'],
    ],
    [
      'dark',
      createTheme('rgb(27, 27, 31)', 'rgb(228, 226, 230)'),
      ['#27272B', '#212125'],
    ],
    ['pure black', createTheme('#000000', '#ffffff'), ['#0F0F0F', '#080808']],
  ])(
    'creates subtle animated colors for the %s theme',
    (_, theme, expected) => {
      expect(getLoadingColors(theme)).toEqual(expected);
    },
  );

  it.each([
    [
      'light',
      createTheme('rgb(254, 251, 255)', 'rgb(27, 27, 31)'),
      ['#F0EEF2', '#F3F0F4'],
    ],
    [
      'dark',
      createTheme('rgb(27, 27, 31)', 'rgb(228, 226, 230)'),
      ['#27272B', '#252529'],
    ],
    ['pure black', createTheme('#000000', '#ffffff'), ['#0F0F0F', '#0D0D0D']],
  ])('increases static contrast for the %s theme', (_, theme, expected) => {
    expect(getLoadingColors(theme, true)).toEqual(expected);
  });

  it.each([
    [false, ['#292A30', '#24242A']],
    [true, ['#292A30', '#27282E']],
  ])(
    'tints the dark palette with animations disabled=%s',
    (disabled, expected) => {
      const theme = createTheme('#1b1b1f', '#e4e2e6');

      expect(getLoadingColors(theme, disabled, '#b1c5ff')).toEqual(expected);
    },
  );

  it('keeps a dark accent visible on a pure black surface', () => {
    const theme = createTheme('#000000', '#ffffff');

    expect(getLoadingColors(theme, false, '#000000')).toEqual([
      '#0A0A0A',
      '#060606',
    ]);
  });
});
