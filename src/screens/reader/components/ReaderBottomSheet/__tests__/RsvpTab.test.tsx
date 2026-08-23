/**
 * RsvpTab — WebView injection contract tests.
 *
 * Contract: every RSVP control must hand injectJavaScript a script that a
 * WebView can actually evaluate, and that script must invoke the intended
 * window.rsvp method. These tests press the real buttons and evaluate the
 * captured scripts exactly as the WebView would (parse the whole string,
 * then run it against an instrumented window.rsvp), so a syntactically
 * invalid injection fails here instead of silently no-oping on device.
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import RsvpTab from '../RsvpTab';

const mockSetStored = jest.fn();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (_key: string) => undefined,
    set: (_key: string, _value: string) => undefined,
    delete: (_key: string) => undefined,
  }),
  useMMKVObject: (_key: string) => [
    undefined,
    (value: unknown) => {
      mockSetStored(value);
    },
  ],
}));

// The theme chain reaches this ESM-only package, which jest's transform
// allowlist doesn't cover; a module mock keeps it from ever evaluating.
jest.mock('@pchmn/expo-material3-theme', () => ({
  useMaterial3Theme: () => ({ theme: {} }),
  getMaterial3Theme: () => ({}),
  isDynamicThemeSupported: () => false,
}));

// The @components barrel transitively imports the database, whose native
// SQLite bindings don't exist under jest; the RSVP tab never touches it.
jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));

// usePlugins -> pluginManager pulls ESM-only packages into the same barrel
// chain; the RSVP tab doesn't render plugin UI.
jest.mock('@hooks/persisted/usePlugins', () => ({
  AVAILABLE_PLUGINS: 'AVAILABLE_PLUGINS',
  INSTALLED_PLUGINS: 'INSTALLED_PLUGINS',
  LANGUAGES_FILTER: 'LANGUAGES_FILTER',
  LAST_USED_PLUGIN: 'LAST_USED_PLUGIN',
  PINNED_PLUGINS: 'PINNED_PLUGINS',
  usePlugins: () => ({
    enabledPlugins: {},
    installedPlugins: [],
    availablePlugins: [],
    languagesFilter: [],
    pinnedPlugins: [],
    lastUsedPlugin: null,
  }),
}));

// The @components barrel transitively imports most of the app (database
// natives, plugin manager ESM, trackers); only Button and Slider are
// rendered here, so mock the barrel with pressable stand-ins whose
// onPress wiring is equivalent.
jest.mock('@components', () => {
  const React = require('react');
  const RN = require('react-native');
  const Button = ({ title, onPress }: { title: string; onPress: () => void }) =>
    React.createElement(
      RN.Pressable,
      { onPress },
      React.createElement(RN.Text, null, title),
    );
  const Slider = () => React.createElement(RN.View, { testID: 'slider' });
  return { __esModule: true, Button, Slider };
});

// Records every script handed to injectJavaScript — the seam where
// RsvpTab talks to the reader WebView.
const mockInjectJavaScript = jest.fn();
const mockWebViewRef = { current: { injectJavaScript: mockInjectJavaScript } };

jest.mock('@screens/reader/ChapterContext', () => ({
  useChapterContext: () => ({ webViewRef: mockWebViewRef }),
}));

const RSVP_METHODS = [
  'start',
  'pause',
  'resume',
  'exit',
  'setWpm',
  'setChunkSize',
] as const;

beforeEach(() => {
  mockInjectJavaScript.mockClear();
  mockSetStored.mockClear();
});

const renderTab = () => render(<RsvpTab />);

/**
 * Evaluates a captured script exactly as the WebView would: parse the
 * whole string (a SyntaxError here means the WebView threw the script
 * away before running anything), then run it against an instrumented
 * window.rsvp. Returns the rsvp methods the script actually invoked.
 */
const runScriptLikeWebView = (script: string): string[] => {
  const calls: string[] = [];
  const rsvp: Record<string, (...args: unknown[]) => void> = {};
  for (const method of RSVP_METHODS) {
    rsvp[method] = (...args: unknown[]) =>
      calls.push(`${method}(${args.join(', ')})`);
  }
  const evaluate = new Function('window', script);
  evaluate({ rsvp });
  return calls;
};

const lastInjectedScript = () => {
  const calls = mockInjectJavaScript.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as string;
};

describe('RsvpTab — WebView injection', () => {
  it('pressing Start injects an evaluable script that starts window.rsvp', () => {
    renderTab();
    fireEvent.press(screen.getByText('Start speed-reading'));

    expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
    expect(runScriptLikeWebView(lastInjectedScript())).toEqual(['start()']);
  });

  it('pressing Pause injects an evaluable script that pauses window.rsvp', () => {
    renderTab();
    fireEvent.press(screen.getByText('⏸'));

    expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
    expect(runScriptLikeWebView(lastInjectedScript())).toEqual(['pause()']);
  });

  it('pressing Exit injects an evaluable script that exits window.rsvp', () => {
    renderTab();
    fireEvent.press(screen.getByText('Exit'));

    expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
    expect(runScriptLikeWebView(lastInjectedScript())).toEqual(['exit()']);
  });

  it('cycling chunk size injects an evaluable script that calls setChunkSize with the next size', () => {
    renderTab();
    fireEvent.press(screen.getByText('Chunk size: 1'));

    expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
    expect(runScriptLikeWebView(lastInjectedScript())).toEqual([
      'setChunkSize(2)',
    ]);
    // setRsvp persists the complete composed settings object
    expect(mockSetStored).toHaveBeenCalledWith({ wpm: 250, chunkSize: 2 });
  });
});
