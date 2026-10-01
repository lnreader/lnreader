import {
  ExtendedFloatingActionButton,
  FloatingActionButton,
} from '@expo/ui/jetpack-compose';
import { useTheme } from '@hooks/persisted/useTheme';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';
import AppText from '../AppText/AppText';

export interface FabProps {
  icon: IconSource;
  label: string;
  onPress: () => void;
  extended?: boolean;
}

const Fab = ({ icon, label, onPress, extended }: FabProps) => {
  const theme = useTheme();
  if (extended) {
    return (
      <ExtendedFloatingActionButton
        onClick={onPress}
        containerColor={theme.primaryContainer}
      >
        <ExtendedFloatingActionButton.Icon>
          {/* The text slot does not reach the semantics tree; the icon names
              the button for TalkBack (and UI tests). */}
          <AppIcon
            source={icon}
            label={label}
            tint={theme.onPrimaryContainer}
          />
        </ExtendedFloatingActionButton.Icon>
        <ExtendedFloatingActionButton.Text>
          <AppText variant="labelLarge" color={theme.onPrimaryContainer}>
            {label}
          </AppText>
        </ExtendedFloatingActionButton.Text>
      </ExtendedFloatingActionButton>
    );
  }
  return (
    <FloatingActionButton
      onClick={onPress}
      containerColor={theme.primaryContainer}
    >
      <FloatingActionButton.Icon>
        <AppIcon source={icon} label={label} tint={theme.onPrimaryContainer} />
      </FloatingActionButton.Icon>
    </FloatingActionButton>
  );
};

export default Fab;
