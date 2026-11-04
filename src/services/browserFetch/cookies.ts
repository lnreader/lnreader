import CookieManager from '@preeternal/react-native-cookie-manager';

const CLEARANCE_COOKIE = 'cf_clearance';

export const getClearance = async (
  url: string,
): Promise<string | undefined> => {
  try {
    const cookies = await CookieManager.get(url);
    return cookies[CLEARANCE_COOKIE]?.value || undefined;
  } catch {
    return undefined;
  }
};
