import NativeDoh, { DohProviderId } from '@modules/native-doh';
import { Dialog, RadioButton } from '@components';
import { getString } from '@i18n/translations';
import { showToast } from '@utils/showToast';
import { useTheme } from '@hooks/persisted';

export const DOH_PROVIDERS: readonly {
  id: DohProviderId;
  label: string;
}[] = [
  { id: 0, label: getString('advancedSettingsScreen.disabled') },
  { id: 1, label: 'Cloudflare' },
  { id: 2, label: 'Google' },
  { id: 3, label: 'AdGuard' },
  { id: 4, label: 'Quad9' },
  { id: 5, label: 'AliDNS' },
  { id: 6, label: 'DNSPod' },
  { id: 7, label: '360' },
  { id: 8, label: 'Quad 101' },
  { id: 9, label: 'Mullvad' },
  { id: 10, label: 'Control D' },
  { id: 11, label: 'Njalla' },
  { id: 12, label: 'Shecan' },
];

interface DohProviderDialogProps {
  provider: DohProviderId;
  visible: boolean;
  onDismiss: () => void;
  onSelect: (provider: DohProviderId) => void;
}

const DohProviderDialog = ({
  provider,
  visible,
  onDismiss,
  onSelect,
}: DohProviderDialogProps) => {
  const theme = useTheme();
  const selectProvider = (nextProvider: DohProviderId) => {
    NativeDoh?.setProvider(nextProvider);
    onSelect(nextProvider);
    onDismiss();
    showToast(getString('advancedSettingsScreen.restartRequired'));
  };

  return (
    <Dialog.Root visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>
        {getString('advancedSettingsScreen.dnsOverHttps')}
      </Dialog.Title>
      <Dialog.Description>
        {getString('advancedSettingsScreen.dnsOverHttpsDescription')}
      </Dialog.Description>
      <Dialog.ScrollArea>
        {DOH_PROVIDERS.map(item => (
          <RadioButton
            key={item.id.toString()}
            label={item.label}
            status={provider === item.id}
            onPress={() => selectProvider(item.id)}
            theme={theme}
          />
        ))}
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action onPress={onDismiss}>
          {getString('common.cancel')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default DohProviderDialog;
