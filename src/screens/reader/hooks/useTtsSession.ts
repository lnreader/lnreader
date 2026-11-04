import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Tts,
  TtsMetadata,
  TtsPlaybackState,
  TtsProgress,
  TtsSession,
  TtsSettings,
  TtsSleepTimerConfig,
  TtsSleepTimerState,
} from '@modules/nitro-tts';

type TtsCommand = 'next' | 'pause' | 'play' | 'previous' | 'replay' | 'stop';

const initialProgress: TtsProgress = {
  index: 0,
  total: 0,
  paragraphId: '',
};

const initialSleepTimer: TtsSleepTimerState = {
  active: false,
  expired: false,
};

export const useTtsSession = () => {
  const sessionRef = useRef<TtsSession | null>(null);
  const sessionPromiseRef = useRef<Promise<TtsSession> | null>(null);
  const subscriptionsRef = useRef<{ remove(): void }[]>([]);
  const mountedRef = useRef(true);
  const [state, setState] = useState<TtsPlaybackState>('idle');
  const [progress, setProgress] = useState<TtsProgress>(initialProgress);
  const [error, setError] = useState<string | null>(null);
  const [sleepTimer, setSleepTimerState] =
    useState<TtsSleepTimerState>(initialSleepTimer);

  const ensureSession = useCallback(async () => {
    if (sessionRef.current) {
      return sessionRef.current;
    }
    if (!sessionPromiseRef.current) {
      sessionPromiseRef.current = Tts.createSession()
        .then(session => {
          if (!mountedRef.current) {
            void session.stop();
            return session;
          }
          sessionRef.current = session;
          subscriptionsRef.current = [
            session.addOnStateChangedListener(setState),
            session.addOnProgressChangedListener(setProgress),
            session.addOnErrorListener(setError),
            session.addOnSleepTimerChangedListener(setSleepTimerState),
          ];
          return session;
        })
        .catch(cause => {
          sessionPromiseRef.current = null;
          throw cause;
        });
    }
    return sessionPromiseRef.current;
  }, []);

  const run = useCallback(
    async (operation: (session: TtsSession) => Promise<void>) => {
      try {
        setError(null);
        await operation(await ensureSession());
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return false;
      }
    },
    [ensureSession],
  );

  const loadQueue = useCallback(
    async (
      queue: string[],
      startIndex: number,
      metadata: TtsMetadata,
      settings: TtsSettings,
      options: {
        autoplay: boolean;
        expectContinuation: boolean;
        canContinue?: () => boolean;
      },
    ) => {
      if (queue.length === 0) {
        setError('No readable paragraphs were found in this chapter.');
        return false;
      }
      return await run(async session => {
        await session.load(
          queue.map((text, index) => ({ id: String(index), text })),
          startIndex,
          metadata,
          settings,
          { expectContinuation: options.expectContinuation },
        );
        if (options.canContinue?.() === false) {
          await session.stop();
          return;
        }
        if (options.autoplay) {
          await session.play();
        }
      });
    },
    [run],
  );

  const loadAndPlay = useCallback(
    (
      queue: string[],
      startIndex: number,
      metadata: TtsMetadata,
      settings: TtsSettings,
      expectContinuation = false,
    ) =>
      loadQueue(queue, startIndex, metadata, settings, {
        autoplay: true,
        expectContinuation,
      }),
    [loadQueue],
  );

  const command = useCallback(
    (nextCommand: TtsCommand) => {
      void run(session => {
        switch (nextCommand) {
          case 'next':
            return session.skipNext();
          case 'pause':
            return session.pause();
          case 'play':
            return session.play();
          case 'previous':
            return session.skipPrevious();
          case 'replay':
            return session.replayCurrent();
          case 'stop':
            return session.stop();
        }
      });
    },
    [run],
  );

  const seekTo = useCallback(
    (index: number) => {
      void run(session => session.seekTo(index));
    },
    [run],
  );

  const updateSettings = useCallback(
    (settings: TtsSettings) => {
      if (sessionRef.current) {
        void run(session => session.updateSettings(settings));
      }
    },
    [run],
  );

  const setSleepTimer = useCallback(
    (config: TtsSleepTimerConfig) => {
      void run(session => session.setSleepTimer(config));
    },
    [run],
  );

  const cancelSleepTimer = useCallback(() => {
    void run(session => session.cancelSleepTimer());
  }, [run]);

  useEffect(() => {
    void ensureSession().catch(cause => {
      if (mountedRef.current) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });
    return () => {
      mountedRef.current = false;
      subscriptionsRef.current.forEach(subscription => subscription.remove());
      subscriptionsRef.current = [];
      if (sessionRef.current) {
        void sessionRef.current.stop();
      }
      sessionRef.current = null;
    };
  }, [ensureSession]);

  return {
    command,
    error,
    cancelSleepTimer,
    loadQueue,
    loadAndPlay,
    progress,
    seekTo,
    state,
    setSleepTimer,
    sleepTimer,
    updateSettings,
  };
};
