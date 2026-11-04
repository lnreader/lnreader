const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export const base64ToBytes = (value: string): Uint8Array => {
  const sanitized = value.replace(/\s/g, '');
  const padding = Number(sanitized.endsWith('=='))
    ? 2
    : Number(sanitized.endsWith('='));
  const bytes = new Uint8Array(
    Math.max(0, Math.floor((sanitized.length * 3) / 4) - padding),
  );
  let byteIndex = 0;

  for (let index = 0; index < sanitized.length; index += 4) {
    const chunk = sanitized.slice(index, index + 4);
    const bits = [...chunk]
      .map(char => BASE64_ALPHABET.indexOf(char).toString(2).padStart(6, '0'))
      .join('');

    for (let offset = 0; offset < 24; offset += 8) {
      if (byteIndex >= bytes.length) {
        break;
      }
      bytes[byteIndex++] = Number.parseInt(bits.slice(offset, offset + 8), 2);
    }
  }

  return bytes;
};
