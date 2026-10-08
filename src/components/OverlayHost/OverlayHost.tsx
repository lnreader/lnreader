import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import AppHost from '../AppHost/AppHost';

// For dialogs and sheets opened outside a `Screen`; Compose dialogs open
// their own window, so the host needs no size.
const OverlayHost = ({ children }: { children: ReactNode }) => (
  <AppHost style={styles.host} pointerEvents="box-none">
    {children}
  </AppHost>
);

const styles = StyleSheet.create({
  host: { position: 'absolute', width: 0, height: 0 },
});

export default OverlayHost;
