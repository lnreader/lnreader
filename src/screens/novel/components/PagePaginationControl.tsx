import React, { useMemo } from 'react';
import { Row } from '@expo/ui/jetpack-compose';
import {
  alpha,
  fillMaxWidth,
  height,
  padding,
  weight,
  defaultMinSize,
} from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';
import { AppIcon, AppText, OutlinedBox } from '@components';
import ChevronLeftIcon from '@expo/material-symbols/chevron_left.xml';
import ChevronRightIcon from '@expo/material-symbols/chevron_right.xml';

interface PagePaginationControlProps {
  pages: string[];
  currentPageIndex: number;
  onPageChange: (pageIndex: number) => void;
  onOpenDrawer: () => void;
  theme: ThemeColors;
}

const PagePaginationControl: React.FC<PagePaginationControlProps> = ({
  pages,
  currentPageIndex,
  onPageChange,
  onOpenDrawer,
  theme,
}) => {
  const totalPages = pages.length;

  const pageIndices = useMemo(() => {
    const indices: (number | 'ellipsis')[] = [];

    if (totalPages <= 3) {
      for (let i = 0; i < totalPages; i++) {
        indices.push(i);
      }
    } else {
      // Always show first page if not current
      if (currentPageIndex !== 0) {
        indices.push(0);
      }

      // Show page before current (with ellipsis if there's a gap)
      const leftPageIndex = currentPageIndex - 1;
      if (leftPageIndex > 0) {
        if (leftPageIndex > 1) {
          indices.push('ellipsis');
        }
      }

      // Always show current page
      indices.push(currentPageIndex);

      // Show ellipsis after current only if there's a gap to last page
      const rightPageIndex = currentPageIndex + 1;
      if (rightPageIndex < totalPages - 1) {
        indices.push('ellipsis');
      }

      // Always show last page if not current
      if (currentPageIndex !== totalPages - 1) {
        indices.push(totalPages - 1);
      }
    }

    return indices;
  }, [currentPageIndex, totalPages]);

  const canGoPrevious = currentPageIndex > 0;
  const canGoNext = currentPageIndex < totalPages - 1;

  const handlePrevious = () => {
    if (canGoPrevious) {
      onPageChange(currentPageIndex - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onPageChange(currentPageIndex + 1);
    }
  };

  const handlePagePress = (pageIndex: number) => {
    if (pageIndex !== currentPageIndex) {
      onPageChange(pageIndex);
    }
  };

  const navButton = (
    icon: typeof ChevronLeftIcon,
    enabled: boolean,
    onPress: () => void,
  ) => (
    <OutlinedBox
      shape={8}
      outlineWidth={1}
      outlineColor={theme.outlineVariant}
      color={theme.surface}
      contentAlignment="center"
      onPress={enabled ? onPress : undefined}
      modifiers={[
        height(40),
        defaultMinSize({ minWidth: 40 }),
        ...(enabled ? [] : [alpha(0.5)]),
      ]}
    >
      <AppIcon
        source={icon}
        size={20}
        tint={enabled ? theme.onSurface : theme.onSurfaceDisabled}
      />
    </OutlinedBox>
  );

  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement={{ spacedBy: 8 }}
      modifiers={[fillMaxWidth(), padding(16, 0, 16, 16)]}
    >
      {navButton(ChevronLeftIcon, canGoPrevious, handlePrevious)}

      <Row
        verticalAlignment="center"
        horizontalArrangement="spaceEvenly"
        modifiers={[weight(1)]}
      >
        {pageIndices.map((pageIndex, index) => {
          if (pageIndex === 'ellipsis') {
            return (
              <OutlinedBox
                key={`ellipsis-${index}`}
                shape={8}
                outlineWidth={1}
                outlineColor={theme.outlineVariant}
                color={theme.surface}
                contentAlignment="center"
                onPress={onOpenDrawer}
                modifiers={[height(40), defaultMinSize({ minWidth: 40 })]}
              >
                <AppText
                  variant="titleMedium"
                  color={theme.onSurface}
                  modifiers={[padding(12, 0, 12, 0)]}
                >
                  ...
                </AppText>
              </OutlinedBox>
            );
          }

          const isActive = pageIndex === currentPageIndex;
          const pageName = pages[pageIndex];
          return (
            <OutlinedBox
              key={`page-${pageIndex}`}
              shape={8}
              outlineWidth={1}
              outlineColor={isActive ? theme.primary : theme.outlineVariant}
              color={isActive ? theme.primary : theme.surface}
              contentAlignment="center"
              onPress={() => handlePagePress(pageIndex)}
              modifiers={[height(40), defaultMinSize({ minWidth: 40 })]}
            >
              <AppText
                variant="bodyLarge"
                weight={isActive ? '600' : '400'}
                color={isActive ? theme.onPrimary : theme.onSurface}
                maxLines={1}
                modifiers={[padding(12, 0, 12, 0)]}
              >
                {pageName}
              </AppText>
            </OutlinedBox>
          );
        })}
      </Row>

      {navButton(ChevronRightIcon, canGoNext, handleNext)}
    </Row>
  );
};

export default PagePaginationControl;
