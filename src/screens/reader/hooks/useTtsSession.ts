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

/**
 * The hook that loaded the current speech. All sessions drive one native
 * player, so a reader that a linked novel covers would otherwise follow and
 * stop the speech of the reader in front. Speech that no hook owns is open to
 * all of them, as with one reader.
 */
let speechOwner: object | null = null;
const speechOwnerListeners = new Set<() => void>();

const ownsSpeech = (owner: object) =>
  speechOwner === null || speechOwner === owner;

const takeSpeech = (owner: object) => {
  if (speechOwner !== owner) {
    speechOwner = owner;
    speechOwnerListeners.forEach(listener => listener());
  }
};

export const useTtsSession = () => {
  const sessionRef = useRef<TtsSession | null>(null);
  const sessionPromiseRef = useRef<Promise<TtsSession> | null>(null);
  const subscriptionsRef = useRef<{ remove(): void }[]>([]);
  const mountedRef = useRef(true);
  const ownerRef = useRef({});
  const loadGenerationRef = useRef(0);
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
          const owner = ownerRef.current;
          const ifOwner =
            <T>(update: (value: T) => void) =>
            (value: T) => {
              if (ownsSpeech(owner)) {
                update(value);
              }
            };
          subscriptionsRef.current = [
            session.addOnStateChangedListener(ifOwner(setState)),
            session.addOnProgressChangedListener(ifOwner(setProgress)),
            session.addOnErrorListener(ifOwner(setError)),
            session.addOnSleepTimerChangedListener(ifOwner(setSleepTimerState)),
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
      if (!ownsSpeech(ownerRef.current)) {
        return false;
      }
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
      const loadGeneration = ++loadGenerationRef.current;
      takeSpeech(ownerRef.current);
      let completed = false;
      const succeeded = await run(async session => {
        await session.load(
          queue.map((text, index) => ({ id: String(index), text })),
          startIndex,
          metadata,
          settings,
          { expectContinuation: options.expectContinuation },
        );
        if (loadGeneration !== loadGenerationRef.current) {
          return;
        }
        if (options.canContinue?.() === false) {
          await session.stop();
          return;
        }
        if (options.autoplay) {
          await session.play();
        }
        completed = true;
      });
      return succeeded && completed;
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
      if (nextCommand === 'stop' && speechOwner === ownerRef.current) {
        // Stopped speech has no owner, so another reader can control it.
        speechOwner = null;
      }
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
    const owner = ownerRef.current;
    const onSpeechOwnerChange = () => {
      if (speechOwner !== owner) {
        // Another hook loaded speech, so this one shows none.
        loadGenerationRef.current += 1;
        setState('idle');
        setProgress(initialProgress);
        setSleepTimerState(initialSleepTimer);
      }
    };
    speechOwnerListeners.add(onSpeechOwnerChange);
    void ensureSession().catch(cause => {
      if (mountedRef.current) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });
    return () => {
      mountedRef.current = false;
      speechOwnerListeners.delete(onSpeechOwnerChange);
      subscriptionsRef.current.forEach(subscription => subscription.remove());
      subscriptionsRef.current = [];
      if (sessionRef.current && ownsSpeech(owner)) {
        void sessionRef.current.stop();
      }
      if (speechOwner === owner) {
        speechOwner = null;
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
