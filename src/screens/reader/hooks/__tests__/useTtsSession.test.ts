import { act, renderHook, waitFor } from '@testing-library/react-native';

import { Tts, type TtsSession } from '@modules/nitro-tts';
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
});
