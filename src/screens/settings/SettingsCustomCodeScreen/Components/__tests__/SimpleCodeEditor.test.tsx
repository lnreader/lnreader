import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MemoizedHighlightedCode, ScrollSink } from '../SimpleCodeEditor';

// The real Prism bundles are ESM under dist/esm and the renderer output is
// irrelevant for the windowing behavior under test.
jest.mock('react-syntax-highlighter', () => {
  const MockLight = Object.assign(
    ({ children }: { children?: React.ReactNode }) => children,
    { registerLanguage: jest.fn() },
  );
  return { PrismLight: MockLight };
});
jest.mock('react-syntax-highlighter/dist/esm/languages/prism/css', () => ({}));
jest.mock(
  'react-syntax-highlighter/dist/esm/languages/prism/javascript',
  () => ({}),
);
jest.mock(
  'react-syntax-highlighter/dist/esm/styles/prism/material-dark',
  () => ({}),
);
jest.mock(
  'react-syntax-highlighter/dist/esm/styles/prism/material-light',
  () => ({}),
);

const CHAR_MEASURE_STENCIL = 'WWWWWWWWWWWWWWWWWWWW';

const LONG_CODE = Array.from(
  { length: 1000 },
  (_, i) => `const line${i} = ${i};`,
).join('\n');

describe('MemoizedHighlightedCode', () => {
  // The RN jest mock never invokes the measure callback, but the component
  // needs the layer position to compute its render window.
  beforeEach(() => {
    const proto = View.prototype as unknown as {
      measureInWindow: (callback: (...args: number[]) => void) => void;
    };
    jest
      .spyOn(proto, 'measureInWindow')
      .mockImplementation(function (
        this: unknown,
        callback: (...args: number[]) => void,
      ) {
        callback(0, 0, 0, 0);
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('recovers when a large edit shrinks content below the scroll window', () => {
    const scrollSink: ScrollSink = { current: null };

    const { rerender } = render(
      <MemoizedHighlightedCode
        value={LONG_CODE}
        mode="js"
        isDark
        style={{ color: '#ffffff' }}
        scrollSink={scrollSink}
      />,
    );

    // Let the layer measure its position, then scroll deep into the
    // document so the render window starts near the end of the content.
    fireEvent(screen.getByText(CHAR_MEASURE_STENCIL), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 120, height: 17 } },
    });
    act(() => {
      scrollSink.current?.(1_000_000);
    });

    // Replace nearly all the content while the window still points at the
    // old end (no scroll event in between). Previously the padding
    // computation read past the end of the line array and crashed with
    // "Cannot read property 'id' of undefined".
    rerender(
      <MemoizedHighlightedCode
        value={'const x = 1;\nconst y = 2;'}
        mode="js"
        isDark
        style={{ color: '#ffffff' }}
        scrollSink={scrollSink}
      />,
    );

    // The next scroll pass corrects the window and the new content shows.
    act(() => {
      scrollSink.current?.(0);
    });

    expect(screen.getByText('const x = 1;')).toBeTruthy();
  });
});
