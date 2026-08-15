import {
  getErrorCauseChain,
  getErrorChainMessages,
  getErrorMessage,
} from '@utils/error';

describe('getErrorMessage', () => {
  it('returns the message of an Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('stringifies non-Error values', () => {
    expect(getErrorMessage('boom')).toBe('boom');
    expect(getErrorMessage(undefined)).toBe('undefined');
    expect(getErrorMessage(null)).toBe('null');
  });
});

describe('getErrorCauseChain', () => {
  it('walks the cause chain', () => {
    const native = new Error('SQL Error: FOREIGN KEY constraint failed');
    const query = new Error('Failed query: INSERT ...\nparams:');
    query.cause = native;
    const wrapper = new Error('Database initialization failed');
    wrapper.cause = query;

    expect(getErrorCauseChain(wrapper)).toEqual([query, native]);
  });

  it('caps the chain depth', () => {
    let head: Error | undefined;
    for (let index = 0; index < 10; index += 1) {
      const next = new Error(`cause ${index}`);
      if (head) {
        next.cause = head;
      }
      head = next;
    }

    expect(getErrorCauseChain(head)).toHaveLength(5);
  });

  it('stops at a non-Error cause', () => {
    const error = new Error('outer');
    error.cause = 'native message';

    expect(getErrorCauseChain(error)).toEqual(['native message']);
  });

  it('returns an empty chain without causes', () => {
    expect(getErrorCauseChain(new Error('plain'))).toEqual([]);
  });
});

describe('getErrorChainMessages', () => {
  it('includes every cause message', () => {
    const native = new Error('SQL Error: FOREIGN KEY constraint failed');
    const query = new Error('Failed query: INSERT ...\nparams:');
    query.cause = native;

    expect(getErrorChainMessages(query)).toEqual([
      'Failed query: INSERT ...\nparams:',
      'SQL Error: FOREIGN KEY constraint failed',
    ]);
  });

  it('stringifies non-Error causes', () => {
    const error = new Error('outer');
    error.cause = 42;

    expect(getErrorChainMessages(error)).toEqual(['outer', '42']);
  });
});
