import {
  getBottomSheetLayout,
  normalizeBottomSheetSnapPoints,
} from '../layout';

describe('bottom sheet layout', () => {
  it('preserves the Material 3 top margin on compact windows', () => {
    expect(
      getBottomSheetLayout({
        bottom: 16,
        height: 800,
        top: 24,
        width: 400,
      }),
    ).toEqual({
      horizontalInset: 0,
      maxHeight: 688,
      topMargin: 72,
    });
  });

  it('centers sheets at the 640dp max width on large windows', () => {
    expect(
      getBottomSheetLayout({
        bottom: 16,
        height: 800,
        top: 24,
        width: 1000,
      }),
    ).toEqual({
      horizontalInset: 180,
      maxHeight: 704,
      topMargin: 56,
    });
  });

  it('sorts and clamps snap points without mutating the caller array', () => {
    const snapPoints = [720, 320, 480];

    expect(normalizeBottomSheetSnapPoints(snapPoints, 600)).toEqual([
      320, 480, 600,
    ]);
    expect(snapPoints).toEqual([720, 320, 480]);
  });
});
