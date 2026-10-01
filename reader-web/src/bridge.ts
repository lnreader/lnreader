import type {
  NativeToWebMessage,
  WebToNativeMessage,
} from '../../src/screens/reader/engine/protocol';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
    lnReader?: { receive(message: NativeToWebMessage): void };
  }
}

export interface Bridge {
  send(message: WebToNativeMessage): void;
}

export const createBridge = (): Bridge => ({
  send: message => {
    window.ReactNativeWebView?.postMessage(JSON.stringify(message));
  },
});
