import { act, renderHook, waitFor } from '@testing-library/react-native';

import { Tts } from '@modules/nitro-tts';
import type { TtsSession } from '@modules/nitro-tts';
import { useTtsSession } from '../useTtsSession';

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
    );
    expect(session.play).toHaveBeenCalledTimes(1);
    expect(session.load.mock.invocationCallOrder[0]).toBeLessThan(
      session.play.mock.invocationCallOrder[0],
    );
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
    ];
    unmount();

    await waitFor(() => expect(session.stop).toHaveBeenCalledTimes(1));
    subscriptions.forEach(item => {
      expect(item.remove).toHaveBeenCalled();
    });
  });
});
