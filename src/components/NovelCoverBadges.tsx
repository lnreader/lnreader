import { Box, Row } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  padding,
  Shapes,
} from '@expo/ui/jetpack-compose/modifiers';
import { getString } from '@i18n/translations';
import { useTheme } from '@hooks/persisted/useTheme';
import DownloadingIcon from '@expo/material-symbols/downloading.xml';
import AppIcon from './AppIcon/AppIcon';
import AppText from './AppText/AppText';

export interface CoverBadges {
  inLibrary?: boolean;
  downloaded?: number | null;
  unread?: number | null;
  busy?: boolean;
}

const Pill = ({
  text,
  color,
  textColor,
}: {
  text: string;
  color: string;
  textColor: string;
}) => (
  <Box modifiers={[background(color), padding(6, 2, 6, 2)]}>
    <AppText variant="labelSmall" weight="700" color={textColor}>
      {text}
    </AppText>
  </Box>
);

export const CoverBadgeRow = ({ badges }: { badges?: CoverBadges }) => {
  const theme = useTheme();
  if (!badges) {
    return null;
  }
  const { inLibrary, downloaded, unread, busy } = badges;
  return (
    <Row modifiers={[clip(Shapes.RoundedCorner(8))]}>
      {inLibrary ? (
        <Pill
          text={getString('novelScreen.inLibaray')}
          color={theme.primary}
          textColor={theme.onPrimary}
        />
      ) : null}
      {downloaded ? (
        <Pill
          text={String(downloaded)}
          color={theme.tertiary}
          textColor={theme.onTertiary}
        />
      ) : null}
      {unread ? (
        <Pill
          text={String(unread)}
          color={theme.primary}
          textColor={theme.onPrimary}
        />
      ) : null}
      {busy ? (
        <Box
          modifiers={[
            background(theme.secondaryContainer),
            padding(4, 2, 4, 2),
          ]}
        >
          <AppIcon
            source={DownloadingIcon}
            size={16}
            tint={theme.onSecondaryContainer}
          />
        </Box>
      ) : null}
    </Row>
  );
};
