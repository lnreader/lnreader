import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { AppRegistry, I18nManager } from 'react-native';
import { i18n } from './src/i18n/translations';
import { installJsCrashHandler } from './src/services/crashLogs/installJsCrashHandler';

installJsCrashHandler();

// The factory only runs when Android dispatches the headless task, so the task
// implementations stay out of the bundle the UI has to evaluate on launch.
AppRegistry.registerHeadlessTask(
  'LNReaderBackgroundTask',
  () =>
    require('./src/services/backgroundTasks/headlessTask')
      .runHeadlessBackgroundTask,
);

const isRTL = i18n.locale.startsWith('ar') || i18n.locale.startsWith('he');
I18nManager.allowRTL(isRTL);
I18nManager.forceRTL(isRTL);

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
