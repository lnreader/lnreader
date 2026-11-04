import { base64ToBytes } from '../base64';

const decode = (value: string) =>
  new TextDecoder().decode(base64ToBytes(value));

describe('base64ToBytes', () => {
  it('decodes padded and unpadded values', () => {
    expect(decode('SGVsbG8=')).toBe('Hello');
    expect(decode('SGVsbG8')).toBe('Hello');
    expect(decode('aGk=')).toBe('hi');
    expect(decode('')).toBe('');
  });

  it('ignores whitespace', () => {
    expect(decode('SGVs\nbG8=')).toBe('Hello');
  });
});
