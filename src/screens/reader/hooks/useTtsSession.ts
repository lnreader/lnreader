import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Tts,
  TtsMetadata,
  TtsPlaybackState,
  TtsProgress,
  TtsSession,
  TtsSettings,
} from '@modules/nitro-tts';

type TtsCommand = 'next' | 'pause' | 'play' | 'previous' | 'replay' | 'stop';

const initialProgress: TtsProgress = {
  index: 0,
  total: 0,
  paragraphId: '',
};

export const useTtsSession = () => {
  const sessionRef = useRef<TtsSession | null>(null);
  const sessionPromiseRef = useRef<Promise<TtsSession> | null>(null);
  const subscriptionsRef = useRef<Array<{ remove(): void }>>([]);
  const mountedRef = useRef(true);
  const [state, setState] = useState<TtsPlaybackState>('idle');
  const [progress, setProgress] = useState<TtsProgress>(initialProgress);
  const [error, setError] = useState<string | null>(null);

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
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [ensureSession],
  );

  const loadAndPlay = useCallback(
    async (
      queue: string[],
      startIndex: number,
      metadata: TtsMetadata,
      settings: TtsSettings,
    ) => {
      if (queue.length === 0) {
        setError('No readable paragraphs were found in this chapter.');
        return;
      }
      await run(async session => {
        await session.load(
          queue.map((text, index) => ({ id: String(index), text })),
          startIndex,
          metadata,
          settings,
        );
        await session.play();
      });
    },
    [run],
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
    loadAndPlay,
    progress,
    seekTo,
    state,
    updateSettings,
  };
};
