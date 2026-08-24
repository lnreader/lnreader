/**
 * TTS bridge injection contract tests — RsvpTab.test.tsx pattern,
 * generalized to the bridge module surface.
 *
 * Contract: every bridge function returns a script that a WebView can
 * actually evaluate, and that script invokes the intended window.tts
 * method with the intended arguments. Tests parse the whole string, then
 * run it against an instrumented window.tts exactly as the WebView would.
 */

import {
  ttsAutoStartScript,
  ttsCompleteScript,
  ttsSetActiveIndexScript,
  ttsSetPlaybackStateScript,
} from '../tts';

const TTS_METHODS = [
  'start',
  'setPlaybackState',
  'setActiveIndex',
  'complete',
] as const;

interface RunEnv {
  window: { tts: Record<string, (...args: unknown[]) => void> };
  reader?: Record<string, unknown>;
}

/** Parses and runs a script like the WebView would; returns invocations. */
const runScriptLikeWebView = (script: string, env: RunEnv): string[] => {
  const calls: string[] = [];
  const recording: Record<string, (...args: unknown[]) => void> = {};
  for (const method of TTS_METHODS) {
    recording[method] = (...args: unknown[]) =>
      calls.push(`${method}(${args.join(', ')})`);
  }
  const resolved: Record<string, unknown> = {
    window: { ...env.window, tts: recording },
    reader: env.reader ?? {},
  };
  // Bare `tts` and `reader` resolve off the browser global (window.tts, and
  // the spliced initialReaderConfig host script) — mirror that by passing
  // them as parameters, the way the WebView's global scope would see them.
  const evaluate = new Function(
    'window',
    'tts',
    'reader',
    'setTimeout',
    script,
  );
  evaluate(resolved.window, recording, resolved.reader, (fn: () => void) =>
    fn(),
  );
  return calls;
};

describe('tts bridge — WebView injection', () => {
  it('setPlaybackState emits an evaluable script that updates window.tts', () => {
    const calls = runScriptLikeWebView(ttsSetPlaybackStateScript('playing'), {
      window: { tts: {} },
    });
    expect(calls).toEqual(['setPlaybackState(playing)']);
  });

  it('every playback state serializes to a parseeable script', () => {
    for (const state of [
      'idle',
      'loading',
      'playing',
      'paused',
      'completed',
      'error',
    ]) {
      const script = ttsSetPlaybackStateScript(state as any);
      expect(() => new Function('window', script)).not.toThrow();
      expect(runScriptLikeWebView(script, { window: { tts: {} } })).toEqual([
        `setPlaybackState(${state})`,
      ]);
    }
  });

  it('complete emits an evaluable script that completes window.tts', () => {
    expect(
      runScriptLikeWebView(ttsCompleteScript(), { window: { tts: {} } }),
    ).toEqual(['complete()']);
  });

  it('setActiveIndex emits an evaluable script with a sanitized index', () => {
    expect(
      runScriptLikeWebView(ttsSetActiveIndexScript(3), { window: { tts: {} } }),
    ).toEqual(['setActiveIndex(3)']);
  });

  it('setActiveIndex sanitizes non-finite indices so emission always parses', () => {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      const script = ttsSetActiveIndexScript(invalid);
      expect(() => new Function('window', script)).not.toThrow();
      expect(runScriptLikeWebView(script, { window: { tts: {} } })).toEqual([
        'setActiveIndex(0)',
      ]);
    }
  });

  it('autoStart no-ops when TTS is disabled in reader settings', () => {
    const calls = runScriptLikeWebView(ttsAutoStartScript(), {
      window: { tts: {} },
      reader: { generalSettings: { val: { TTSEnable: false } } },
    });
    expect(calls).toEqual([]);
  });

  it('autoStart starts TTS when enabled, mirroring the onLoadEnd path', () => {
    const calls = runScriptLikeWebView(ttsAutoStartScript(), {
      window: { tts: {} },
      reader: { generalSettings: { val: { TTSEnable: true } } },
    });
    expect(calls).toEqual(['start()']);
  });
});
