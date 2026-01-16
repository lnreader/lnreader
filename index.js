import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { I18nManager } from 'react-native';
import { i18n } from './strings/translations';

const isRTL = i18n.locale.startsWith('ar') || i18n.locale.startsWith('he');
I18nManager.allowRTL(isRTL);
I18nManager.forceRTL(isRTL);

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
