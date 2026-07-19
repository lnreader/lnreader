import { ToastAndroid } from 'react-native';

export const showToast = (...message: string[]) => {
  ToastAndroid.show(message.join(' '), ToastAndroid.SHORT);
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.trace('Toast: ', message);
  }
};
