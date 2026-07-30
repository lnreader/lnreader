import { fireEvent, render, screen } from '@testing-library/react-native';

import type { BackupOptions } from '@services/backup/options';
import type { ThemeColors } from '@theme/types';
import { BackupOptionsList } from '../BackupOptions';

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockTheme,
}));

const mockTheme = {
  onSurface: '#111111',
  onSurfaceDisabled: '#777777',
  onSurfaceVariant: '#555555',
  outlineVariant: '#cccccc',
  primary: '#6200ee',
  rippleColor: '#eeeeee',
} as ThemeColors;

const allSelected: BackupOptions = {
  library: true,
  settings: true,
  plugins: true,
  downloadedFiles: true,
};

describe('BackupOptionsList', () => {
  it('supports selecting and clearing every backup section', () => {
    const onChange = jest.fn();
    render(
      <BackupOptionsList
        onChange={onChange}
        options={allSelected}
        theme={mockTheme}
      />,
    );

    fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'backupScreen.options.selectAll',
      }),
    );

    expect(onChange).toHaveBeenCalledWith({
      library: false,
      settings: false,
      plugins: false,
      downloadedFiles: false,
    });
  });

  it('clears downloaded files when library data is deselected', () => {
    const onChange = jest.fn();
    render(
      <BackupOptionsList
        onChange={onChange}
        options={allSelected}
        theme={mockTheme}
      />,
    );

    fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'backupScreen.options.library',
      }),
    );

    expect(onChange).toHaveBeenCalledWith({
      library: false,
      settings: true,
      plugins: true,
      downloadedFiles: false,
    });
  });

  it('disables downloaded files when library data is not selected', () => {
    render(
      <BackupOptionsList
        onChange={() => {}}
        options={{
          ...allSelected,
          library: false,
          downloadedFiles: false,
        }}
        theme={mockTheme}
      />,
    );

    expect(
      screen.getByRole('checkbox', {
        name: 'backupScreen.options.downloadedFiles',
      }),
    ).toBeDisabled();
  });
});
