import type { BrowserFetchRequest } from './types';

export const CLOUDFLARE_MESSAGE_TYPE = 'lnreader-cloudflare';
export const BROWSER_FETCH_MESSAGE_TYPE = 'lnreader-browser-fetch';

export const CLOUDFLARE_LISTENER_SCRIPT = `
(function () {
  function send(event) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: "${CLOUDFLARE_MESSAGE_TYPE}",
        event: event
      }));
    }
  }

  addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "cloudflare-challenge") {
      return;
    }
    send(data.event);
  });

  function detectChallenge() {
    var text = "";
    try {
      text =
        (document.title || "") +
        " " +
        (document.body ? document.body.innerText.slice(0, 4000) : "");
    } catch (_) {}

    if (
      window._cf_chl_opt ||
      /Just a moment|Checking your browser|Enable JavaScript and cookies/i.test(text)
    ) {
      send("challengeDetected");
    }
  }

  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", detectChallenge);
  } else {
    detectChallenge();
  }
  setTimeout(detectChallenge, 1500);
})();
true;
`;

const serialize = (value: unknown) =>
  JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export const buildDocumentResponseScript = (
  requestId: string,
  status: number,
  statusText: string,
  maxResponseLength: number,
) => {
  const payload = serialize({
    messageType: BROWSER_FETCH_MESSAGE_TYPE,
    requestId,
    status,
    statusText,
    maxResponseLength,
  });

  return `
(function () {
  var payload = ${payload};

  function send(data) {
    if (!window.ReactNativeWebView) {
      return;
    }
    window.ReactNativeWebView.postMessage(
      JSON.stringify({
        type: payload.messageType,
        requestId: payload.requestId,
        status: data.status,
        statusText: data.statusText,
        url: data.url,
        headers: data.headers,
        body: data.body,
        error: data.error,
      }),
    );
  }

  try {
    var contentType = document.contentType || "text/html";
    var textOnly = /json|text\\/plain|javascript|xml|csv/i.test(contentType);
    var body = textOnly
      ? (document.body ? document.body.innerText : document.documentElement.innerText)
      : document.documentElement.outerHTML;
    body = body || "";

    if (body.length > payload.maxResponseLength) {
      send({
        error:
          "Browser response exceeded the maximum allowed size of " +
          payload.maxResponseLength +
          " characters.",
      });
      return;
    }

    send({
      status: payload.status,
      statusText: payload.statusText,
      url: location.href,
      headers: { "content-type": contentType },
      body: body,
    });
  } catch (error) {
    send({ error: String((error && error.message) || error) });
  }
})();
true;
`;
};

export const buildBrowserFetchScript = (
  requestId: string,
  request: BrowserFetchRequest,
) => {
  const payload = serialize({
    messageType: BROWSER_FETCH_MESSAGE_TYPE,
    requestId,
    request,
  });

  return `
(function () {
  var payload = ${payload};
  var request = payload.request;

  function send(data) {
    if (!window.ReactNativeWebView) {
      return;
    }
    window.ReactNativeWebView.postMessage(
      JSON.stringify({
        type: payload.messageType,
        requestId: payload.requestId,
        status: data.status,
        statusText: data.statusText,
        url: data.url,
        headers: data.headers,
        body: data.body,
        error: data.error,
      }),
    );
  }

  (async function () {
    var controller =
      typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) {
        controller.abort();
      }
    }, request.timeoutMs);

    try {
      var response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        credentials: 'include',
        redirect: 'follow',
        cache: 'no-store',
        signal: controller ? controller.signal : undefined,
      });
      clearTimeout(timer);

      var body = await response.text();

      if (body.length > request.maxResponseLength) {
        send({
          error:
            'Browser response exceeded the maximum allowed size of ' +
            request.maxResponseLength +
            ' characters.',
        });
        return;
      }

      var headers = {};
      response.headers.forEach(function (value, key) {
        headers[key] = value;
      });

      send({
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: headers,
        body: body,
      });
    } catch (error) {
      clearTimeout(timer);
      send({ error: String((error && error.message) || error) });
    }
  })();
})();
true;
`;
};
