import { defaultTheme } from './defaultTheme';
import { midnightDusk } from './mignightDusk';
import { tealTurquoise } from './tealTurquoise';
import { yotsubaTheme } from './yotsuba';
import { lavenderTheme } from './lavender';
import { strawberryDaiquiriTheme } from './strawberry';
import { takoTheme } from './tako';
import { catppuccinTheme } from './catppuccin';
import { yinyangTheme } from './yinyang';
import { ePaperTheme } from './ePaper';

export const E_PAPER_THEME_ID = 109;

/**
 * Exports for MD3 theme system
 *
 * IMPORTANT:
 * IDs are auto-assigned, so new themes
 * need to be added at the end of the list.
 */
export const lightThemes = [
  defaultTheme.light,
  midnightDusk.light,
  tealTurquoise.light,
  yotsubaTheme.light,
  lavenderTheme.light,
  strawberryDaiquiriTheme.light,
  takoTheme.light,
  catppuccinTheme.light,
  yinyangTheme.light,
  ePaperTheme.light,
].map((theme, i) => ({ ...theme, id: 100 + i }));
export const darkThemes = [
  defaultTheme.dark,
  midnightDusk.dark,
  tealTurquoise.dark,
  yotsubaTheme.dark,
  lavenderTheme.dark,
  strawberryDaiquiriTheme.dark,
  takoTheme.dark,
  catppuccinTheme.dark,
  yinyangTheme.dark,
  ePaperTheme.dark,
].map((theme, i) => ({ ...theme, id: 100 + i }));
