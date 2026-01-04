import { ToastAndroid } from 'react-native';

export const showToast = (message: string) => {
  ToastAndroid.show(message, ToastAndroid.SHORT);
  if (__DEV__) {
    console.trace('Toast: ', message);
  }
};
