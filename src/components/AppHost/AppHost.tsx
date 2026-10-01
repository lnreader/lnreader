import { Host, type HostProps } from '@expo/ui/jetpack-compose';
import { useTheme } from '@hooks/persisted/useTheme';

export type AppHostProps = Omit<HostProps, 'seedColor' | 'colorScheme'>;

// `Host` can only be themed with a seed, so the components in src/components pass the
// theme's exact colours to each component.
const AppHost = ({ children, ...props }: AppHostProps) => {
  const theme = useTheme();
  return (
    <Host
      {...props}
      seedColor={theme.primary}
      colorScheme={theme.isDark ? 'dark' : 'light'}
    >
      {children}
    </Host>
  );
};

export default AppHost;
