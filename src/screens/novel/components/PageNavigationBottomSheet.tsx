import { Row } from '@expo/ui/jetpack-compose';
import {
  background,
  clickable,
  fillMaxWidth,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';
import color from 'color';

import { AppText, BottomSheet } from '@components';
import { ThemeColors } from '@theme/types';

interface PageNavigationBottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  theme: ThemeColors;
  pages: string[];
  pageIndex: number;
  openPage: (index: number) => void;
}

export default function PageNavigationBottomSheet({
  visible,
  onDismiss,
  theme,
  pages,
  pageIndex,
  openPage,
}: PageNavigationBottomSheetProps) {
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      {pages.map((item, index) => {
        const isSelected = index === pageIndex;
        return (
          <Row
            key={`page_${index}_${item}`}
            verticalAlignment="center"
            modifiers={[
              fillMaxWidth(),
              ...(isSelected
                ? [
                    background(
                      theme.isDark
                        ? color(theme.primary).alpha(0.2).string()
                        : color(theme.primaryContainer).alpha(0.5).string(),
                    ),
                  ]
                : []),
              clickable(() => {
                openPage(index);
                onDismiss();
              }),
              padding(24, 16, 24, 16),
            ]}
          >
            <AppText
              variant="bodyLarge"
              color={isSelected ? theme.primary : theme.onSurfaceVariant}
            >
              Page {item}
            </AppText>
          </Row>
        );
      })}
    </BottomSheet>
  );
}
