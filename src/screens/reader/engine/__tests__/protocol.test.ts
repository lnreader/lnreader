import { parseWebMessage, toInjectedScript } from '../protocol';

describe('parseWebMessage', () => {
  it('accepts well-formed messages', () => {
    expect(parseWebMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(
      parseWebMessage(
        JSON.stringify({
          type: 'relocate',
          chapterId: 3,
          fraction: 0.2,
          endFraction: 0.4,
          page: 2,
          pages: 9,
          atStart: false,
          atEnd: false,
        }),
      ),
    ).toMatchObject({ type: 'relocate', chapterId: 3, page: 2 });
    expect(
      parseWebMessage(
        JSON.stringify({
          type: 'tts-queue',
          chapterId: 1,
          utterances: ['a', 'b'],
        }),
      ),
    ).toMatchObject({ utterances: ['a', 'b'] });
  });

  it.each([
    ['not json', 'nope'],
    ['not an object', '42'],
    ['unknown type', '{"type":"format-disk"}'],
    ['missing field', '{"type":"request-section","requestId":1}'],
    ['wrong field type', '{"type":"selection","text":5}'],
    ['bad list', '{"type":"tts-queue","chapterId":1,"utterances":[1]}'],
    ['bad direction', '{"type":"boundary","direction":"up"}'],
    [
      'bad optional field',
      '{"type":"relocate","chapterId":1,"fraction":0,"endFraction":0,"atStart":true,"atEnd":false,"page":"2"}',
    ],
  ])('drops %s', (_, raw) => {
    expect(parseWebMessage(raw)).toBeUndefined();
  });
});

describe('toInjectedScript', () => {
  it('hands the message to the page and evaluates to true', () => {
    const script = toInjectedScript({ type: 'turn', direction: 'next' });
    expect(script).toBe(
      'window.lnReader && window.lnReader.receive({"type":"turn","direction":"next"});true;',
    );
  });

  it('keeps markup inert inside the script', () => {
    const script = toInjectedScript({
      type: 'section-content',
      requestId: 1,
      html: '</script><p>"quote"</p>',
    });
    const receive = jest.fn();

    new Function('window', script)({ lnReader: { receive } });
    expect(receive).toHaveBeenCalledWith({
      type: 'section-content',
      requestId: 1,
      html: '</script><p>"quote"</p>',
    });
  });
});
