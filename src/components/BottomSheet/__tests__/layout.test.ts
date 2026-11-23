import { getBottomSheetMaxHeight, toBottomSheetDetents } from '../layout';

describe('bottom sheet layout', () => {
  it('preserves the Material 3 top margin on compact windows', () => {
    expect(
      getBottomSheetMaxHeight({ bottom: 16, height: 800, top: 24, width: 400 }),
    ).toBe(688);
  });

  it('uses the smaller top margin on large windows', () => {
    expect(
      getBottomSheetMaxHeight({
        bottom: 16,
        height: 800,
        top: 24,
        width: 1000,
      }),
    ).toBe(704);
  });

  it('converts snap points to sorted window fractions without mutating them', () => {
    const snapPoints = [600, 200];

    expect(toBottomSheetDetents(snapPoints, 700, 800)).toEqual([0.25, 0.75]);
    expect(snapPoints).toEqual([600, 200]);
  });

  it('clamps snap points to the available height', () => {
    expect(toBottomSheetDetents([720], 400, 800)).toEqual([0.5]);
  });

  it('keeps at most three detents', () => {
    expect(toBottomSheetDetents([100, 200, 300, 400], 800, 800)).toHaveLength(
      3,
    );
  });
});
