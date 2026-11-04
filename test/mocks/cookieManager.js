jest.mock('@preeternal/react-native-cookie-manager', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({})),
    getAll: jest.fn(() => Promise.resolve({})),
    set: jest.fn(() => Promise.resolve(true)),
    setFromResponse: jest.fn(() => Promise.resolve(true)),
    getFromResponse: jest.fn(() => Promise.resolve({})),
    clearAll: jest.fn(() => Promise.resolve(true)),
    clearByName: jest.fn(() => Promise.resolve(true)),
    flush: jest.fn(() => Promise.resolve()),
    removeSessionCookies: jest.fn(() => Promise.resolve(true)),
  },
}));
