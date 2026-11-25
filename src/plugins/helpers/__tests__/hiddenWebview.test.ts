import {
  completeHiddenWebviewRequest,
  fetchViaWebviewForSite,
  subscribeHiddenWebview,
  validateSameOriginUrl,
} from '../hiddenWebview';

const mountAutoCompletingHost = (
  title: string,
  html: string,
  seen?: number[],
) =>
  subscribeHiddenWebview(req => {
    if (!req) {
      return;
    }
    seen?.push(req.id);
    Promise.resolve().then(() => {
      completeHiddenWebviewRequest(req.id, {
        ok: true,
        url: req.url,
        html,
        title,
      });
    });
  });

describe('hiddenWebview', () => {
  it('validates same-origin URLs and rejects cross-origin or invalid URLs', () => {
    expect(
      validateSameOriginUrl(
        'https://fenrirealm.com/series/test/16',
        'https://fenrirealm.com',
      ),
    ).toBe('https://fenrirealm.com/series/test/16');

    expect(() =>
      validateSameOriginUrl('https://evil.com/steal', 'https://fenrirealm.com'),
    ).toThrow('cross-origin');

    expect(() =>
      validateSameOriginUrl('javascript:alert(1)', 'https://fenrirealm.com'),
    ).toThrow('unsupported protocol');

    expect(() =>
      validateSameOriginUrl('https://fenrirealm.com/a', undefined),
    ).toThrow('plugin site is not configured');
  });

  it('queues requests sequentially and resolves when completed', async () => {
    const seen: number[] = [];
    const unsubscribe = mountAutoCompletingHost(
      'Test',
      '<html><body>ok</body></html>',
      seen,
    );

    try {
      const [r1, r2] = await Promise.all([
        fetchViaWebviewForSite(
          'https://fenrirealm.com/1',
          'https://fenrirealm.com',
        ),
        fetchViaWebviewForSite(
          'https://fenrirealm.com/2',
          'https://fenrirealm.com',
        ),
      ]);
      expect(r1.ok).toBe(true);
      expect(r2.url).toBe('https://fenrirealm.com/2');
      expect(seen.length).toBe(2);
    } finally {
      unsubscribe();
    }
  });

  it('keeps pending requests until a host subscribes within timeoutMs', async () => {
    const pending = fetchViaWebviewForSite(
      'https://fenrirealm.com/pending',
      'https://fenrirealm.com',
      { timeoutMs: 2000 },
    );

    const unsubscribe = mountAutoCompletingHost(
      'Late',
      '<html><body>late-host</body></html>',
    );

    try {
      const res = await pending;
      expect(res.ok).toBe(true);
      expect(res.title).toBe('Late');
    } finally {
      unsubscribe();
    }
  });

  it('times out queued requests when no host subscribes', async () => {
    jest.useFakeTimers();
    try {
      const pending = fetchViaWebviewForSite(
        'https://fenrirealm.com/no-host',
        'https://fenrirealm.com',
        { timeoutMs: 500 },
      ).catch(err => err);
      await jest.advanceTimersByTimeAsync(500);
      const err = await pending;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain(
        'timed out waiting for HiddenWebViewHost',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects active request on last host unmount and times out queued requests', async () => {
    jest.useFakeTimers();
    try {
      const unsubscribe = subscribeHiddenWebview(() => {});
      const first = fetchViaWebviewForSite(
        'https://fenrirealm.com/first',
        'https://fenrirealm.com',
        { timeoutMs: 1000 },
      );
      const second = fetchViaWebviewForSite(
        'https://fenrirealm.com/second',
        'https://fenrirealm.com',
        { timeoutMs: 1000 },
      ).catch(err => err);

      unsubscribe();

      await expect(first).rejects.toThrow('HiddenWebViewHost unmounted');
      await jest.advanceTimersByTimeAsync(1000);
      const secondErr = await second;
      expect(secondErr).toBeInstanceOf(Error);
      expect((secondErr as Error).message).toContain(
        'timed out waiting for HiddenWebViewHost',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('grants queued requests a fresh timeoutMs budget when activated', async () => {
    jest.useFakeTimers();
    try {
      let currentId: number | null = null;
      const unsubscribe = subscribeHiddenWebview(req => {
        currentId = req?.id ?? null;
      });

      const first = fetchViaWebviewForSite(
        'https://fenrirealm.com/first',
        'https://fenrirealm.com',
        { timeoutMs: 1000 },
      );
      const second = fetchViaWebviewForSite(
        'https://fenrirealm.com/second',
        'https://fenrirealm.com',
        { timeoutMs: 1000 },
      );

      // Spend 800ms on first request while second is queued
      await jest.advanceTimersByTimeAsync(800);
      completeHiddenWebviewRequest(currentId!, {
        ok: true,
        url: 'https://fenrirealm.com/first',
        html: '<html>1</html>',
        title: '1',
      });
      await expect(first).resolves.toMatchObject({ ok: true });

      // Second request should still have a full 1000ms after activation
      await jest.advanceTimersByTimeAsync(800);
      completeHiddenWebviewRequest(currentId!, {
        ok: true,
        url: 'https://fenrirealm.com/second',
        html: '<html>2</html>',
        title: '2',
      });
      await expect(second).resolves.toMatchObject({ ok: true, title: '2' });

      unsubscribe();
    } finally {
      jest.useRealTimers();
    }
  });
});
