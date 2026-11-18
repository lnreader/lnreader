import * as Haptics from 'expo-haptics';
import { ScrubController } from '../ScrubController';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));

describe('ScrubController', () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    jest.clearAllMocks();
    jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation(callback => frames.push(callback));
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(id => {
      frames[(id as number) - 1] = () => {};
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const runFrame = () => {
    const pending = frames;
    frames = [];
    pending.forEach(callback => callback(0));
  };

  it('coalesces scrubs to one per frame using the newest index', () => {
    const onScrub = jest.fn();
    const setLabel = jest.fn();
    const controller = new ScrubController({
      onScrub,
      setLabel,
      getLabel: index => `Chapter ${index}`,
    });

    controller.schedule(10);
    controller.schedule(20);
    controller.schedule(30);
    expect(onScrub).not.toHaveBeenCalled();

    runFrame();
    expect(onScrub).toHaveBeenCalledTimes(1);
    expect(onScrub).toHaveBeenCalledWith(30);
    expect(setLabel).toHaveBeenLastCalledWith('Chapter 30');

    controller.schedule(40);
    runFrame();
    expect(onScrub).toHaveBeenLastCalledWith(40);
  });

  it('flushes the pending scrub synchronously on release', () => {
    const onScrub = jest.fn();
    const onScrubEnd = jest.fn();
    const controller = new ScrubController({ onScrub, onScrubEnd });

    controller.schedule(5);
    controller.release(5);

    expect(onScrub).toHaveBeenCalledWith(5);
    expect(onScrubEnd).toHaveBeenCalledWith(5);

    runFrame();
    expect(onScrub).toHaveBeenCalledTimes(1);
  });

  it('ignores release without any movement', () => {
    const onScrub = jest.fn();
    const onScrubEnd = jest.fn();
    const controller = new ScrubController({ onScrub, onScrubEnd });

    controller.release(-1);

    expect(onScrub).not.toHaveBeenCalled();
    expect(onScrubEnd).not.toHaveBeenCalled();
  });

  it('only fires haptics on grab when enabled', () => {
    const controller = new ScrubController({ onScrub: jest.fn() });
    controller.grab(0);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();

    controller.setHandlers({ onScrub: jest.fn(), hapticFeedback: true });
    controller.grab(0);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('uses the latest handlers after they change', () => {
    const first = jest.fn();
    const second = jest.fn();
    const controller = new ScrubController({ onScrub: first });

    controller.schedule(1);
    controller.setHandlers({ onScrub: second });
    runFrame();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(1);
  });
});
