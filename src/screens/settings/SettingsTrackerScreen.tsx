import { useState, type ReactNode } from 'react';
import { Image, ListItem } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxWidth,
  Shapes,
  size,
} from '@expo/ui/jetpack-compose/modifiers';

import { getTracker, useTheme, useTracker } from '@hooks/persisted';
import {
  AppIcon,
  AppText,
  ConfirmationDialog,
  List,
  listItemColors,
} from '@components';
import SettingsPage from './components/SettingsPage';
import CheckIcon from '@expo/material-symbols/check.xml';
import { TrackerSettingsScreenProps } from '@navigators/types';
import { getString } from '@i18n/translations';
import TrackerLoginDialog from './components/TrackerLoginDialog';
import { authenticateWithCredentials as mangaUpdatesAuth } from '@services/Trackers/mangaUpdates';
import { authenticateWithCredentials as kitsuAuth } from '@services/Trackers/kitsu';
import { showToast } from '@utils/showToast';

interface TrackerCheckIconProps {
  theme: any;
  checked: boolean;
}

const TrackerCheckIcon = ({ theme, checked }: TrackerCheckIconProps) => {
  if (!checked) {
    return null;
  }
  return <AppIcon source={CheckIcon} tint={theme.primary} />;
};

const TrackerLogo = ({ source }: { source: number }) => (
  <Image
    source={source}
    contentScale="fit"
    modifiers={[size(32, 32), clip(Shapes.RoundedCorner(4))]}
  />
);

const AniListLogo = () => (
  <TrackerLogo source={require('../../../assets/anilist.png')} />
);

const MyAnimeListLogo = () => (
  <TrackerLogo source={require('../../../assets/mal.png')} />
);

const MangaUpdatesLogo = () => (
  <TrackerLogo source={require('../../../assets/mangaupdates.png')} />
);

const KitsuLogo = () => (
  <TrackerLogo source={require('../../../assets/kitsu.png')} />
);

const TrackerItem = ({
  title,
  left,
  right,
  onPress,
}: {
  title: string;
  left: ReactNode;
  right: ReactNode;
  onPress: () => void;
}) => {
  const theme = useTheme();
  return (
    <ListItem
      colors={listItemColors(theme)}
      modifiers={[fillMaxWidth(), clickable(onPress)]}
    >
      <ListItem.LeadingContent>{left}</ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <AppText variant="bodyLarge">{title}</AppText>
      </ListItem.HeadlineContent>
      <ListItem.TrailingContent>{right}</ListItem.TrailingContent>
    </ListItem>
  );
};

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

  // Credential-based Login Dialog (MangaUpdates, Kitsu)
  const [credentialLoginTracker, setCredentialLoginTracker] = useState<
    'MangaUpdates' | 'Kitsu' | null
  >(null);
  const showCredentialLogin = (tracker: 'MangaUpdates' | 'Kitsu') =>
    setCredentialLoginTracker(tracker);
  const hideCredentialLogin = () => setCredentialLoginTracker(null);

  const handleCredentialLogin = async (username: string, password: string) => {
    if (!credentialLoginTracker) {
      return;
    }

    try {
      let auth;
      if (credentialLoginTracker === 'MangaUpdates') {
        auth = await mangaUpdatesAuth(username, password);
      } else if (credentialLoginTracker === 'Kitsu') {
        auth = await kitsuAuth(username, password);
      } else {
        throw new Error('Unknown tracker');
      }

      setTracker(credentialLoginTracker, auth);
      hideCredentialLogin();
      showToast(`Successfully logged in to ${credentialLoginTracker}`);
    } catch (error) {
      if (error instanceof Error) {
        throw error; /* Let the dialog handle the error display */
      }
      throw new Error(`Failed to authenticate with ${credentialLoginTracker}`);
    }
  };

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return (
    <SettingsPage
      title={getString('tracking')}
      onBack={() => navigation.goBack()}
      overlays={
        <>
          <ConfirmationDialog
            title={getString('common.logout')}
            message={getString('trackingScreen.logOutMessage', {
              name: logoutTrackerName,
            })}
            visible={visible}
            confirmLabel={getString('common.logout')}
            confirmTone="danger"
            onConfirm={() => {
              removeTracker(logoutTrackerName as any);
              hideModal();
            }}
            onDismiss={hideModal}
          />
          <TrackerLoginDialog
            visible={credentialLoginTracker !== null}
            trackerName={credentialLoginTracker || ''}
            onDismiss={hideCredentialLogin}
            onSubmit={handleCredentialLogin}
            usernameLabel={
              credentialLoginTracker === 'Kitsu' ? 'Email' : 'Username'
            }
          />
        </>
      }
    >
      <List.Section>
        <List.SubHeader theme={theme}>
          {getString('trackingScreen.services')}
        </List.SubHeader>
        <TrackerItem
          title="AniList"
          left={<AniListLogo />}
          right={
            <TrackerCheckIcon
              theme={theme}
              checked={isTrackerAuthenticated('AniList')}
            />
          }
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
        />
        <TrackerItem
          title="MyAnimeList"
          left={<MyAnimeListLogo />}
          right={
            <TrackerCheckIcon
              theme={theme}
              checked={isTrackerAuthenticated('MyAnimeList')}
            />
          }
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
        />
        <TrackerItem
          title="MangaUpdates"
          left={<MangaUpdatesLogo />}
          right={
            <TrackerCheckIcon
              theme={theme}
              checked={isTrackerAuthenticated('MangaUpdates')}
            />
          }
          onPress={() => {
            if (isTrackerAuthenticated('MangaUpdates')) {
              showModal('MangaUpdates');
            } else {
              showCredentialLogin('MangaUpdates');
            }
          }}
        />
        <TrackerItem
          title="Kitsu"
          left={<KitsuLogo />}
          right={
            <TrackerCheckIcon
              theme={theme}
              checked={isTrackerAuthenticated('Kitsu')}
            />
          }
          onPress={() => {
            if (isTrackerAuthenticated('Kitsu')) {
              showModal('Kitsu');
            } else {
              showCredentialLogin('Kitsu');
            }
          }}
        />
        <List.InfoItem title={getString('trackingScreen.info')} theme={theme} />
        {(isTrackerAuthenticated('MyAnimeList') &&
          getTrackerAuth('MyAnimeList')?.auth?.expiresAt &&
          getTrackerAuth('MyAnimeList')!.auth.expiresAt < new Date(now)) ||
        (isTrackerAuthenticated('Kitsu') &&
          getTrackerAuth('Kitsu')?.auth?.expiresAt &&
          getTrackerAuth('Kitsu')!.auth.expiresAt < new Date(now)) ? (
          <>
            <List.SubHeader theme={theme}>
              {getString('common.settings')}
            </List.SubHeader>
            {isTrackerAuthenticated('MyAnimeList') &&
              getTrackerAuth('MyAnimeList')?.auth?.expiresAt &&
              getTrackerAuth('MyAnimeList')!.auth.expiresAt < new Date(now) && (
                <List.Item
                  title={
                    getString('trackingScreen.revalidate') + ' MyAnimeList'
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
              )}
            {isTrackerAuthenticated('Kitsu') &&
              getTrackerAuth('Kitsu')?.auth?.expiresAt &&
              getTrackerAuth('Kitsu')!.auth.expiresAt < new Date(now) && (
                <List.Item
                  title={getString('trackingScreen.revalidate') + ' Kitsu'}
                  onPress={async () => {
                    const trackerAuth = getTrackerAuth('Kitsu');
                    const revalidate = getTracker('Kitsu')?.revalidate;
                    if (revalidate && trackerAuth) {
                      try {
                        const auth = await revalidate(trackerAuth.auth);
                        setTracker('Kitsu', auth);
                        showToast('Successfully refreshed Kitsu session');
                      } catch {
                        showToast(
                          'Failed to refresh Kitsu session. Please log in again.',
                        );
                        removeTracker('Kitsu');
                      }
                    }
                  }}
                  theme={theme}
                />
              )}
          </>
        ) : null}
      </List.Section>
    </SettingsPage>
  );
};

export default TrackerScreen;
