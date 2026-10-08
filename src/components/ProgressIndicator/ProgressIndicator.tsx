import {
  CircularProgressIndicator,
  LinearProgressIndicator,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  type ModifierConfig,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted/useTheme';

const ProgressIndicator = ({
  progress,
  circular,
  modifiers,
}: {
  /** Omit for indeterminate. */
  progress?: number | null;
  circular?: boolean;
  modifiers?: ModifierConfig[];
}) => {
  const theme = useTheme();
  const colors = { color: theme.primary, trackColor: theme.secondaryContainer };
  return circular ? (
    <CircularProgressIndicator
      progress={progress}
      {...colors}
      modifiers={modifiers}
    />
  ) : (
    <LinearProgressIndicator
      progress={progress}
      {...colors}
      modifiers={modifiers ?? [fillMaxWidth()]}
    />
  );
};

export default ProgressIndicator;
