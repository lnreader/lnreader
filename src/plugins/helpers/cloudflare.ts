import NativeCloudflare from '@modules/native-cloudflare';

const SOLVE_TIMEOUT_MS = 30_000;
// A challenge the hidden WebView could not clear (interactive Turnstile, IP
// block) fails the same way on the next request, so a library update must not
// spend the full timeout again for every novel from that site.
const FAILURE_COOLDOWN_MS = 5 * 60_000;
// Requests that were challenged while a solve was running reuse its result
// instead of opening another WebView.
const SUCCESS_REUSE_MS = 30_000;

type SolveResult = { solved: boolean; at: number };

const inFlightSolves = new Map<string, Promise<boolean>>();
const lastResults = new Map<string, SolveResult>();

/**
 * `cf-mitigated: challenge` is Cloudflare's documented marker for a challenge page:
 * https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/
 */
export const isCloudflareChallenge = (response: Response) =>
  response.headers.get('cf-mitigated') === 'challenge';

// cf_clearance is bound to the User-Agent, so a clearance (or failure) for one
// User-Agent says nothing about another on the same host.
const getSolveKey = (url: string, userAgent: string) => {
  try {
    const host = new URL(url).host;
    return host ? `${host}\n${userAgent}` : undefined;
  } catch {
    return undefined;
  }
};

const isFresh = ({ solved, at }: SolveResult) =>
  Date.now() - at < (solved ? SUCCESS_REUSE_MS : FAILURE_COOLDOWN_MS);

/**
 * Solves the Cloudflare challenge for `url` in a hidden WebView. At most one
 * solve runs per host and User-Agent; concurrent callers share it.
 *
 * @param userAgent must match the User-Agent of the request being retried,
 * because Cloudflare binds `cf_clearance` to it.
 */
export const solveCloudflareChallenge = (
  url: string,
  userAgent: string,
): Promise<boolean> => {
  const key = getSolveKey(url, userAgent);
  if (!NativeCloudflare || !key) {
    return Promise.resolve(false);
  }

  const inFlight = inFlightSolves.get(key);
  if (inFlight) {
    return inFlight;
  }
  const lastResult = lastResults.get(key);
  if (lastResult && isFresh(lastResult)) {
    return Promise.resolve(lastResult.solved);
  }

  const solve = NativeCloudflare.solveChallenge(
    url,
    userAgent,
    SOLVE_TIMEOUT_MS,
  )
    .catch(() => false)
    .then(solved => {
      lastResults.set(key, { solved, at: Date.now() });
      inFlightSolves.delete(key);
      return solved;
    });
  inFlightSolves.set(key, solve);
  return solve;
};
