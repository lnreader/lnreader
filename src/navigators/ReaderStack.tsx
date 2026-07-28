import { useRef } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import Novel from '../screens/novel/NovelScreen';
import Reader from '../screens/reader/ReaderScreen';

import {
  ChapterScreenProps,
  NovelScreenProps,
  ReaderStackParamList,
} from './types';
import { NovelContextProvider } from '@screens/novel/NovelContext';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';

const Stack = createNativeStackNavigator<ReaderStackParamList>();

// @ts-ignore
const ReaderStack = ({ route }) => {
  const params = useRef(route?.params);
  const theme = useTheme();
  // The reader has a background of its own, so the screen is given the same one
  // to keep the app background from showing while the chapter is pushed.
  const { theme: readerBackground } = useChapterReaderSettings();
  // eslint-disable-next-line react-hooks/refs
  const routeParams = route?.params ?? params.current;

  return (
    <NovelContextProvider
      route={
        routeParams as NovelScreenProps['route'] | ChapterScreenProps['route']
      }
    >
      <Stack.Navigator
        screenOptions={{
          contentStyle: { backgroundColor: theme.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="Novel" component={Novel} />
        <Stack.Screen
          name="Chapter"
          component={Reader}
          options={{ contentStyle: { backgroundColor: readerBackground } }}
        />
      </Stack.Navigator>
    </NovelContextProvider>
  );
};

export default ReaderStack;
