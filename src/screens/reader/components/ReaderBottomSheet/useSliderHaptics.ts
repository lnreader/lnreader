import { useAppSettings } from '@hooks/persisted';

export const useSliderHaptics = () => !useAppSettings().disableHapticFeedback;
