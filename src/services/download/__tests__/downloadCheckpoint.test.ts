import { parseDownloadCheckpoint } from '../downloadCheckpoint';

describe('download checkpoint', () => {
  it('restores the next chapter and previous failures', () => {
    expect(
      parseDownloadCheckpoint(
        JSON.stringify({ nextIndex: 50, failures: ['Chapter 12 failed'] }),
        200,
      ),
    ).toEqual({ nextIndex: 50, failures: ['Chapter 12 failed'] });
  });

  it('clamps a checkpoint to the current batch size', () => {
    expect(
      parseDownloadCheckpoint(
        JSON.stringify({ nextIndex: 250, failures: [] }),
        200,
      ).nextIndex,
    ).toBe(200);
  });

  it.each([undefined, 'invalid', JSON.stringify({ nextIndex: '50' })])(
    'starts from the beginning for an invalid checkpoint',
    checkpoint => {
      expect(parseDownloadCheckpoint(checkpoint, 200).nextIndex).toBe(0);
    },
  );
});
