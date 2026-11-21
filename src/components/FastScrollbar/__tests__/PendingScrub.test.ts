import { PendingScrub, type PendingScrubTarget } from '../PendingScrub';

describe('PendingScrub', () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation(callback => frames.push(callback));
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const runFrame = () => {
    const pending = frames;
    frames = [];
    pending.forEach(callback => callback(0));
  };

  const setup = () => {
    // 1000 of 4000 chapters loaded, 64px rows, 1000px viewport.
    const state = { contentLength: 64000, scrollLength: 1000 };
    const target: PendingScrubTarget = {
      getList: () => ({ getState: () => state }),
      itemCount: 4000,
      loadedCount: 1000,
      onRequestItems: jest.fn(),
      onResolved: jest.fn(),
    };
    return { state, target, pending: new PendingScrub(target) };
  };

  it('requests items once per new furthest index', () => {
    const { target, pending } = setup();

    pending.request(0.5, 2000);
    pending.request(0.5, 2000);
    pending.request(0.4, 1600);
    expect(target.onRequestItems).toHaveBeenCalledTimes(1);
    expect(target.onRequestItems).toHaveBeenCalledWith(2000);

    pending.request(0.6, 2400);
    expect(target.onRequestItems).toHaveBeenLastCalledWith(2400);
  });

  it('scrolls to the matching offset once the items have loaded', () => {
    const { state, target, pending } = setup();

    pending.request(0.5, 2000);
    state.contentLength = 192000;
    pending.setTarget({ ...target, loadedCount: 3000 });
    expect(target.onResolved).not.toHaveBeenCalled();

    runFrame();
    // 50% of 4000 is 2/3 of the 3000 loaded: (2/3) * (192000 - 1000).
    expect(target.onResolved).toHaveBeenCalledWith((2 / 3) * (192000 - 1000));
  });

  it('keeps waiting while the target is still beyond the loaded items', () => {
    const { target, pending } = setup();

    pending.request(0.9, 3600);
    pending.setTarget({ ...target, loadedCount: 2000 });
    runFrame();

    expect(target.onResolved).not.toHaveBeenCalled();
  });

  it('does nothing after being cancelled', () => {
    const { target, pending } = setup();

    pending.request(0.5, 2000);
    pending.cancel();
    pending.setTarget({ ...target, loadedCount: 3000 });
    runFrame();

    expect(target.onResolved).not.toHaveBeenCalled();
    pending.request(0.5, 2000);
    expect(target.onRequestItems).toHaveBeenCalledTimes(2);
  });

  it('drops a resolution that was already queued when cancelled', () => {
    const { target, pending } = setup();

    pending.request(0.5, 2000);
    pending.setTarget({ ...target, loadedCount: 3000 });
    pending.cancel();
    runFrame();

    expect(target.onResolved).not.toHaveBeenCalled();
  });
});
