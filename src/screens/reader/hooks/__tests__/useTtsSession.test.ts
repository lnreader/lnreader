import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  Tts,
  type TtsPlaybackState,
  type TtsSession,
} from '@modules/nitro-tts';
import { useTtsSession } from '../useTtsSession';

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(nextResolve => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

const getNativeSession = async (): Promise<jest.Mocked<TtsSession>> => {
  const createSession = Tts.createSession as jest.Mock;
  await waitFor(() => expect(createSession).toHaveBeenCalled());
  return createSession.mock.results[0].value as Promise<
    jest.Mocked<TtsSession>
  >;
};

describe('useTtsSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the paragraph queue before playing it', async () => {
    const { result } = renderHook(useTtsSession);
    const session = await getNativeSession();

    await act(async () => {
      await result.current.loadAndPlay(
        ['First paragraph', 'Second paragraph'],
        1,
        {
          novelName: 'Novel',
          chapterName: 'Chapter',
        },
        {
          rate: 1.2,
          pitch: 0.9,
        },
      );
    });

    expect(session.load).toHaveBeenCalledWith(
      [
        { id: '0', text: 'First paragraph' },
        { id: '1', text: 'Second paragraph' },
      ],
      1,
      {
        novelName: 'Novel',
        chapterName: 'Chapter',
      },
      {
        rate: 1.2,
        pitch: 0.9,
      },
      { expectContinuation: false },
    );
    expect(session.play).toHaveBeenCalledTimes(1);
    expect(session.load.mock.invocationCallOrder[0]).toBeLessThan(
      session.play.mock.invocationCallOrder[0],
    );
  });

  it('stops a queue whose chapter transition was cancelled while loading', async () => {
    const { result } = renderHook(useTtsSession);
    const session = await getNativeSession();

    await act(async () => {
      await result.current.loadQueue(
        ['Next chapter'],
        0,
        { novelName: 'Novel', chapterName: 'Next' },
        { rate: 1, pitch: 1 },
        {
          autoplay: true,
          expectContinuation: true,
          canContinue: () => false,
        },
      );
    });

    expect(session.load).toHaveBeenCalledTimes(1);
    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(session.play).not.toHaveBeenCalled();
  });

  it('does not let a cancelled load stop a newer queue', async () => {
    const { result } = renderHook(useTtsSession);
    const session = await getNativeSession();
    const oldNativeLoad = createDeferred<void>();
    session.load.mockImplementationOnce(() => oldNativeLoad.promise);
    let oldTransitionActive = true;
    let oldLoad!: Promise<boolean>;

    act(() => {
      oldLoad = result.current.loadQueue(
        ['Automatically loaded chapter'],
        0,
        { novelName: 'Novel', chapterName: 'Automatic' },
        { rate: 1, pitch: 1 },
        {
          autoplay: true,
          expectContinuation: true,
          canContinue: () => oldTransitionActive,
        },
      );
    });
    await waitFor(() => expect(session.load).toHaveBeenCalledTimes(1));

    oldTransitionActive = false;
    let newLoad!: Promise<boolean>;
    act(() => {
      newLoad = result.current.loadAndPlay(
        ['User-selected chapter'],
        0,
        { novelName: 'Novel', chapterName: 'Selected' },
        { rate: 1, pitch: 1 },
      );
    });
    await waitFor(() => expect(session.play).toHaveBeenCalledTimes(1));

    await act(async () => {
      oldNativeLoad.resolve();
      await expect(oldLoad).resolves.toBe(false);
      await expect(newLoad).resolves.toBe(true);
    });

    expect(session.stop).not.toHaveBeenCalled();
    expect(session.play).toHaveBeenCalledTimes(1);
  });

  it('maps reader controls to native paragraph commands', async () => {
    const { result } = renderHook(useTtsSession);
    const session = await getNativeSession();

    act(() => {
      result.current.command('previous');
      result.current.command('pause');
      result.current.command('next');
      result.current.seekTo(3);
    });

    await waitFor(() => {
      expect(session.skipPrevious).toHaveBeenCalledTimes(1);
      expect(session.pause).toHaveBeenCalledTimes(1);
      expect(session.skipNext).toHaveBeenCalledTimes(1);
      expect(session.seekTo).toHaveBeenCalledWith(3);
    });
  });

  it('stops the native session and removes listeners on unmount', async () => {
    const { unmount } = renderHook(useTtsSession);
    const session = await getNativeSession();
    await waitFor(() =>
      expect(session.addOnErrorListener).toHaveBeenCalledTimes(1),
    );

    const subscriptions = [
      session.addOnStateChangedListener.mock.results[0].value,
      session.addOnProgressChangedListener.mock.results[0].value,
      session.addOnErrorListener.mock.results[0].value,
      session.addOnSleepTimerChangedListener.mock.results[0].value,
    ];
    unmount();

    await waitFor(() => expect(session.stop).toHaveBeenCalledTimes(1));
    subscriptions.forEach(item => {
      expect(item.remove).toHaveBeenCalled();
    });
  });

  describe('with two readers', () => {
    // A reader under a linked novel stays mounted. Both hooks get the same
    // native session, as on the device.
    const renderTwoReaders = async () => {
      const { result: covered, unmount: closeCovered } =
        renderHook(useTtsSession);
      const { result: front, unmount: closeFront } = renderHook(useTtsSession);
      const session = await getNativeSession();
      await waitFor(() =>
        expect(session.addOnStateChangedListener).toHaveBeenCalledTimes(2),
      );
      const emit = (state: TtsPlaybackState, index = 0) =>
        act(() => {
          session.addOnStateChangedListener.mock.calls.forEach(([listener]) =>
            listener(state),
          );
          session.addOnProgressChangedListener.mock.calls.forEach(
            ([listener]) => listener({ index, total: 5, paragraphId: '' }),
          );
        });
      return { covered, front, closeCovered, closeFront, session, emit };
    };

    const speak = (hook: { current: ReturnType<typeof useTtsSession> }) =>
      act(async () => {
        await hook.current.loadAndPlay(
          ['Paragraph'],
          0,
          { novelName: 'Novel', chapterName: 'Chapter' },
          { rate: 1, pitch: 1 },
          true,
        );
      });

    it('lets only the reader that loaded speech follow it', async () => {
      const { covered, front, emit } = await renderTwoReaders();

      await speak(front);
      emit('loading', 4);

      expect(front.current.state).toBe('loading');
      expect(front.current.progress.index).toBe(4);
      expect(covered.current.state).toBe('idle');
      expect(covered.current.progress.index).toBe(0);
    });

    it('moves speech to the reader that loads it last', async () => {
      const { covered, front, emit } = await renderTwoReaders();
      await speak(covered);
      emit('playing', 2);

      await speak(front);

      expect(covered.current.state).toBe('idle');
      expect(covered.current.progress.index).toBe(0);
      emit('playing', 3);
      expect(front.current.state).toBe('playing');
      expect(covered.current.state).toBe('idle');
    });

    it('lets only the owner stop or control speech', async () => {
      const { covered, front, closeCovered, closeFront, session } =
        await renderTwoReaders();
      await speak(front);
      session.play.mockClear();

      act(() => {
        covered.current.command('stop');
        covered.current.command('play');
        covered.current.seekTo(1);
        covered.current.cancelSleepTimer();
      });
      closeCovered();
      // The front reader's command passes after any that the covered one sent.
      act(() => front.current.command('pause'));
      await waitFor(() => expect(session.pause).toHaveBeenCalledTimes(1));

      expect(session.stop).not.toHaveBeenCalled();
      expect(session.play).not.toHaveBeenCalled();
      expect(session.seekTo).not.toHaveBeenCalled();
      expect(session.cancelSleepTimer).not.toHaveBeenCalled();

      closeFront();
      await waitFor(() => expect(session.stop).toHaveBeenCalledTimes(1));
    });

    it('gives stopped speech back to every reader', async () => {
      const { covered, front, session } = await renderTwoReaders();
      await speak(front);

      act(() => front.current.command('stop'));
      await waitFor(() => expect(session.stop).toHaveBeenCalledTimes(1));
      act(() => covered.current.cancelSleepTimer());

      await waitFor(() =>
        expect(session.cancelSleepTimer).toHaveBeenCalledTimes(1),
      );
    });
  });
});
