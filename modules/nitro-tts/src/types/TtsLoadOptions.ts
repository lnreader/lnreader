/** Controls native behavior when the active chapter queue reaches its end. */
export interface TtsLoadOptions {
  /** Keep the foreground session alive while JavaScript loads the next chapter. */
  expectContinuation: boolean;
}
