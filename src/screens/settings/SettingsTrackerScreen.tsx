import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import {
  Portal,
  Text,
  Button,
  Provider,
  List as PaperList,
} from 'react-native-paper';

import { getTracker, useTheme, useTracker } from '@hooks/persisted';
import { Appbar, List, Modal, SafeAreaView } from '@components';
import { TrackerSettingsScreenProps } from '@navigators/types';
import { getString } from '@strings/translations';
import MangaUpdatesLoginDialog from './components/MangaUpdatesLoginDialog';
import { authenticateWithCredentials } from '@services/Trackers/mangaUpdates';
import { showToast } from '@utils/showToast';

interface TrackerCheckIconProps {
  theme: any;
  checked: boolean;
}

const TrackerCheckIcon = ({ theme, checked, ...props }: TrackerCheckIconProps) => {
  if (!checked) {
    return null;
  }
  return (
    <PaperList.Icon
      {...props}
      color={theme.primary}
      icon="check"
      style={styles.iconStyle}
    />
  );
};

const AniListLogo = () => (
  <View style={styles.logoContainer}>
    <Image
      source={require('../../../assets/anilist.png')}
      style={styles.trackerLogo}
    />
  </View>
);

const MyAnimeListLogo = () => (
  <View style={styles.logoContainer}>
    <Image
      source={require('../../../assets/mal.png')}
      style={styles.trackerLogo}
    />
  </View>
);

const MangaUpdatesLogo = () => (
  <View style={styles.logoContainer}>
    <Image
      source={require('../../../assets/mangaupdates.png')}
      style={styles.trackerLogo}
    />
  </View>
);

const TrackerScreen = ({ navigation }: TrackerSettingsScreenProps) => {
  const theme = useTheme();
  const { isTrackerAuthenticated, setTracker, removeTracker, getTrackerAuth } =
    useTracker();

  // Tracker Modal for logout confirmation
  const [logoutTrackerName, setLogoutTrackerName] = useState<string>('');
  const [visible, setVisible] = useState(false);
  const showModal = (trackerName: string) => {
    setLogoutTrackerName(trackerName);
    setVisible(true);
  };
  const hideModal = () => {
    setVisible(false);
    setLogoutTrackerName('');
  };

  // MangaUpdates Login Dialog
  const [mangaUpdatesLoginVisible, setMangaUpdatesLoginVisible] =
    useState(false);
  const showMangaUpdatesLogin = () => setMangaUpdatesLoginVisible(true);
  const hideMangaUpdatesLogin = () => setMangaUpdatesLoginVisible(false);

  const handleMangaUpdatesLogin = async (
    username: string,
    password: string,
  ) => {
    try {
      const auth = await authenticateWithCredentials(username, password);
      setTracker('MangaUpdates', auth);
      hideMangaUpdatesLogin();
      showToast('Successfully logged in to MangaUpdates');
    } catch (error) {
      if (error instanceof Error) {
        throw error; // Let the dialog handle the error display
      }
      throw new Error('Failed to authenticate with MangaUpdates');
    }
  };

  const renderAniListRight = useCallback(
    (props: any) => (
      <TrackerCheckIcon
        {...props}
        theme={theme}
        checked={isTrackerAuthenticated('AniList')}
      />
    ),
    [theme, isTrackerAuthenticated],
  );

  const renderMyAnimeListRight = useCallback(
    (props: any) => (
      <TrackerCheckIcon
        {...props}
        theme={theme}
        checked={isTrackerAuthenticated('MyAnimeList')}
      />
    ),
    [theme, isTrackerAuthenticated],
  );

  const renderMangaUpdatesRight = useCallback(
    (props: any) => (
      <TrackerCheckIcon
        {...props}
        theme={theme}
        checked={isTrackerAuthenticated('MangaUpdates')}
      />
    ),
    [theme, isTrackerAuthenticated],
  );

  return (
    <SafeAreaView excludeTop>
      <Provider>
        <Appbar
          title={getString('tracking')}
          handleGoBack={() => navigation.goBack()}
          theme={theme}
        />
        <View
          style={[
            { backgroundColor: theme.background },
            styles.flex1,
            styles.screenPadding,
          ]}
        >
          <List.Section>
            <List.SubHeader theme={theme}>
              {getString('trackingScreen.services')}
            </List.SubHeader>
            <PaperList.Item
              title="AniList"
              titleStyle={{ color: theme.onSurface }}
              left={AniListLogo}
              right={renderAniListRight}
              onPress={async () => {
                if (isTrackerAuthenticated('AniList')) {
                  showModal('AniList');
                } else {
                  const auth = await getTracker('AniList').authenticate();
                  if (auth) {
                    setTracker('AniList', auth);
                  }
                }
              }}
              rippleColor={theme.rippleColor}
              style={styles.listItem}
            />
            <PaperList.Item
              title="MyAnimeList"
              titleStyle={{ color: theme.onSurface }}
              left={MyAnimeListLogo}
              right={renderMyAnimeListRight}
              onPress={async () => {
                if (isTrackerAuthenticated('MyAnimeList')) {
                  showModal('MyAnimeList');
                } else {
                  const auth = await getTracker('MyAnimeList').authenticate();
                  if (auth) {
                    setTracker('MyAnimeList', auth);
                  }
                }
              }}
              rippleColor={theme.rippleColor}
              style={styles.listItem}
            />
            <PaperList.Item
              title="MangaUpdates"
              titleStyle={{ color: theme.onSurface }}
              left={MangaUpdatesLogo}
              right={renderMangaUpdatesRight}
              onPress={() => {
                if (isTrackerAuthenticated('MangaUpdates')) {
                  showModal('MangaUpdates');
                } else {
                  showMangaUpdatesLogin();
                }
              }}
              rippleColor={theme.rippleColor}
              style={styles.listItem}
            />
            {isTrackerAuthenticated('MyAnimeList') &&
              getTrackerAuth('MyAnimeList')?.auth?.expiresAt &&
              getTrackerAuth('MyAnimeList')!.auth.expiresAt <
              new Date(Date.now()) ? (
              <>
                <List.Divider theme={theme} />
                <List.SubHeader theme={theme}>
                  {getString('common.settings')}
                </List.SubHeader>
                <List.Item
                  title={
                    getString('trackingScreen.revalidate') + ' Myanimelist'
                  }
                  onPress={async () => {
                    const trackerAuth = getTrackerAuth('MyAnimeList');
                    const revalidate = getTracker('MyAnimeList')?.revalidate;
                    if (revalidate && trackerAuth) {
                      const auth = await revalidate(trackerAuth.auth);
                      setTracker('MyAnimeList', auth);
                    }
                  }}
                  theme={theme}
                />
              </>
            ) : null}
          </List.Section>

          <Portal>
            <Modal visible={visible} onDismiss={hideModal}>
              <Text style={[{ color: theme.onSurface }, styles.modalText]}>
                {getString('trackingScreen.logOutMessage', {
                  name: logoutTrackerName,
                })}
              </Text>
              <View style={styles.modalButtonRow}>
                <Button
                  style={styles.modalButton}
                  labelStyle={[
                    { color: theme.primary },
                    styles.modalButtonLabel,
                  ]}
                  onPress={hideModal}
                >
                  {getString('common.cancel')}
                </Button>
                <Button
                  style={styles.modalButton}
                  labelStyle={[
                    { color: theme.primary },
                    styles.modalButtonLabel,
                  ]}
                  onPress={() => {
                    removeTracker(logoutTrackerName as any);
                    hideModal();
                  }}
                >
                  {getString('common.logout')}
                </Button>
              </View>
            </Modal>
            <MangaUpdatesLoginDialog
              visible={mangaUpdatesLoginVisible}
              onDismiss={hideMangaUpdatesLogin}
              onSubmit={handleMangaUpdatesLogin}
            />
          </Portal>
        </View>
      </Provider>
    </SafeAreaView>
  );
};

export default TrackerScreen;

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  screenPadding: {
    paddingVertical: 8,
  },
  modalText: {
    fontSize: 18,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    marginTop: 30,
  },
  modalButtonLabel: {
    letterSpacing: 0,
    textTransform: 'none',
  },
  logoContainer: {
    paddingLeft: 16,
    justifyContent: 'center',
  },
  trackerLogo: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
    borderRadius: 4,
  },
  listItem: {
    paddingVertical: 12,
  },
  iconStyle: {
    margin: 0,
  },
});
