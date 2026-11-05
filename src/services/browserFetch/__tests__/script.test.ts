import { buildDocumentResponseScript } from '../script';

const runDocumentScript = (html: string, maxResponseLength: number) => {
  const postMessage = jest.fn();
  const script = buildDocumentResponseScript(
    'request-1',
    200,
    'OK',
    maxResponseLength,
  );
  const fakeDocument = {
    contentType: 'text/html',
    documentElement: { outerHTML: html },
  };

  new Function('window', 'document', 'location', script)(
    { ReactNativeWebView: { postMessage } },
    fakeDocument,
    { href: 'https://example.com/novel' },
  );

  return JSON.parse(postMessage.mock.calls[0][0]);
};

describe('buildDocumentResponseScript', () => {
  it('sends the document as text', () => {
    const html = '<html><body>Café</body></html>';

    expect(runDocumentScript(html, 1000)).toMatchObject({
      requestId: 'request-1',
      status: 200,
      url: 'https://example.com/novel',
      body: html,
    });
  });

  it('rejects documents over the size limit', () => {
    const message = runDocumentScript('<html>too long</html>', 5);

    expect(message.body).toBeUndefined();
    expect(message.error).toMatch(/maximum allowed size/);
  });
});
