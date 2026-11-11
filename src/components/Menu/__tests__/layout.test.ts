import { getMenuPosition } from '../layout';

const screen = { height: 800, width: 400 };
const noInsets = { bottom: 0, left: 0, right: 0, top: 0 };
const navBarInsets = { bottom: 48, left: 0, right: 0, top: 24 };
const menu = { height: 120, width: 200 };

describe('getMenuPosition', () => {
  it.each([
    {
      name: 'opens below the anchor when there is room',
      anchor: { height: 56, width: 300, x: 24, y: 200 },
      insets: navBarInsets,
      menu,
      expected: { left: 24, top: 260 },
    },
    {
      name: 'opens above an anchor that would push it behind the navigation bar',
      anchor: { height: 56, width: 300, x: 24, y: 580 },
      insets: navBarInsets,
      menu,
      expected: { left: 24, top: 456 },
    },
    {
      name: 'opens below the same anchor when there is no navigation bar',
      anchor: { height: 56, width: 300, x: 24, y: 580 },
      insets: noInsets,
      menu,
      expected: { left: 24, top: 640 },
    },
    {
      name: 'keeps a tall menu below the status bar',
      anchor: { height: 56, width: 300, x: 24, y: 100 },
      insets: navBarInsets,
      menu: { height: 700, width: 200 },
      expected: { left: 24, top: 32 },
    },
    {
      name: 'stays clear of a side navigation bar',
      anchor: { height: 56, width: 100, x: 300, y: 200 },
      insets: { ...noInsets, right: 48 },
      menu,
      expected: { left: 136, top: 260 },
    },
  ])('$name', ({ anchor, insets, menu: menuSize, expected }) => {
    expect(getMenuPosition({ anchor, insets, menu: menuSize, screen })).toEqual(
      expected,
    );
  });
});
