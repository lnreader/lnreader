import { ScrubController, type ScrubTarget } from '../ScrubController';

const createList = (contentLength = 10000, scrollLength = 1000) => {
  const state = { contentLength, scrollLength, scroll: 0 };
  return {
    state,
    getState: () => state,
    scrollToOffset: jest.fn(({ offset }: { offset: number }) => {
      state.scroll = Math.min(
        Math.max(offset, 0),
        contentLength - scrollLength,
      );
    }),
    scrollToIndex: jest.fn(({ index }: { index: number }) => {
      state.scroll = index * 10;
    }),
  };
};

describe('ScrubController', () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    jest.useFakeTimers();
    frames = [];
    jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation(callback => frames.push(callback));
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(id => {
      frames[(id as number) - 1] = () => {};
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const runFrame = () => {
    const pending = frames;
    frames = [];
    pending.forEach(callback => callback(0));
  };

  const setup = (overrides: Partial<ScrubTarget> = {}) => {
    const list = createList();
    const target: ScrubTarget = {
      getList: () => list,
      itemCount: 500,
      loadedCount: 500,
      onRequestItems: jest.fn(),
      onSettleTarget: jest.fn(),
      onSettleTimeout: jest.fn(),
      ...overrides,
    };
    return { list, target, controller: new ScrubController(target) };
  };

  it('coalesces scrubs to one offset scroll per frame using the newest progress', () => {
    const { list, controller } = setup();

    controller.begin();
    controller.schedule(0.1);
    controller.schedule(0.3);
    controller.schedule(0.5);
    expect(list.scrollToOffset).not.toHaveBeenCalled();

    runFrame();
    expect(list.scrollToOffset).toHaveBeenCalledTimes(1);
    // Same mapping the thumb uses: progress * (content - viewport).
    expect(list.scrollToOffset).toHaveBeenCalledWith({
      offset: 4500,
      animated: false,
    });
  });

  it('flushes on release and reports where the list landed', () => {
    const { list, target, controller } = setup();

    controller.begin();
    controller.schedule(1);
    controller.release(1);

    expect(list.scrollToOffset).toHaveBeenCalledWith({
      offset: 9000,
      animated: false,
    });
    expect(target.onSettleTarget).toHaveBeenCalledWith(9000);

    runFrame();
    expect(list.scrollToOffset).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for the list after a timeout', () => {
    const { target, controller } = setup();

    controller.begin();
    controller.release(0.5);
    expect(target.onSettleTimeout).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(target.onSettleTimeout).toHaveBeenCalledTimes(1);
  });

  it('settles immediately when released without moving', () => {
    const { list, target, controller } = setup();

    controller.begin();
    controller.release(-1);

    expect(list.scrollToOffset).not.toHaveBeenCalled();
    expect(target.onSettleTimeout).toHaveBeenCalledTimes(1);
  });

  it('maps progress over all items when only some are loaded', () => {
    const { list, controller } = setup({ itemCount: 4000, loadedCount: 1000 });

    controller.begin();
    controller.schedule(0.1);
    runFrame();

    // 10% of 4000 items is 40% of the 1000 loaded ones.
    expect(list.scrollToOffset).toHaveBeenCalledWith({
      offset: 3600,
      animated: false,
    });
  });

  it('requests unloaded items, then scrolls to them once they arrive', () => {
    const { list, target, controller } = setup({
      itemCount: 4000,
      loadedCount: 1000,
    });

    controller.begin();
    controller.schedule(0.5);
    runFrame();
    expect(target.onRequestItems).toHaveBeenCalledWith(2000);
    expect(list.scrollToOffset).not.toHaveBeenCalled();
    expect(list.scrollToIndex).not.toHaveBeenCalled();

    controller.release(0.5);
    expect(target.onRequestItems).toHaveBeenCalledTimes(1);
    expect(target.onSettleTarget).not.toHaveBeenCalled();

    controller.setTarget({ ...target, loadedCount: 3000 });
    runFrame();

    expect(list.scrollToIndex).toHaveBeenCalledWith({
      index: 2000,
      animated: false,
    });
    expect(target.onSettleTarget).toHaveBeenCalledWith(20000);
  });

  it('drops the pending request when scrubbing back into loaded items', () => {
    const { list, target, controller } = setup({
      itemCount: 4000,
      loadedCount: 1000,
    });

    controller.begin();
    controller.schedule(0.5);
    runFrame();
    controller.schedule(0.1);
    runFrame();
    controller.release(0.1);

    controller.setTarget({ ...target, loadedCount: 3000 });
    runFrame();

    expect(list.scrollToIndex).not.toHaveBeenCalled();
    expect(target.onSettleTarget).toHaveBeenCalledTimes(1);
  });
});
