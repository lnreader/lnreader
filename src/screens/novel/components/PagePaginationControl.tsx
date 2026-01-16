import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { IconButton } from 'react-native-paper';
import color from 'color';
import { ThemeColors } from '@theme/types';
import { Row } from '@components/Common';
import { borderColor } from '@theme/colors';

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
      if (currentPageIndex !== 0) {
        indices.push(0);
      }

      const leftPageIndex = currentPageIndex - 1;
      if (leftPageIndex > 0) {
        if (leftPageIndex > 1) {
          indices.push('ellipsis');
        }
        indices.push(leftPageIndex);
      }

      indices.push(currentPageIndex);

      if (currentPageIndex < totalPages - 1) {
        indices.push('ellipsis');
      }

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

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.button,
          styles.navButton,
          {
            borderColor: borderColor,
            backgroundColor: theme.surface,
          },
          !canGoPrevious && styles.disabledButton,
        ]}
        onPress={handlePrevious}
        disabled={!canGoPrevious}
        android_ripple={{ color: theme.rippleColor }}
      >
        <IconButton
          icon="chevron-left"
          iconColor={canGoPrevious ? theme.onSurface : theme.onSurfaceDisabled}
          size={20}
          style={styles.iconButton}
        />
      </Pressable>

      <Row style={styles.pageNumbersRow}>
        {pageIndices.map((pageIndex, index) => {
          if (pageIndex === 'ellipsis') {
            return (
              <Pressable
                key={`ellipsis-${index}`}
                style={[
                  styles.button,
                  styles.ellipsisButton,
                  {
                    borderColor: borderColor,
                    backgroundColor: theme.surface,
                  },
                ]}
                onPress={onOpenDrawer}
                android_ripple={{ color: theme.rippleColor }}
              >
                <Text style={[styles.ellipsisText, { color: theme.onSurface }]}>
                  ...
                </Text>
              </Pressable>
            );
          }

          const isActive = pageIndex === currentPageIndex;
          const pageName = pages[pageIndex];
          return (
            <Pressable
              key={`page-${pageIndex}`}
              style={[
                styles.button,
                {
                  backgroundColor: isActive ? theme.primary : theme.surface,
                },
                isActive ? styles.activeButton : styles.inactiveButton,
              ]}
              onPress={() => handlePagePress(pageIndex)}
              android_ripple={{
                color: isActive
                  ? color(theme.onPrimary).alpha(0.2).string()
                  : theme.rippleColor,
              }}
            >
              <Text
                style={[
                  styles.pageText,
                  {
                    color: isActive ? theme.onPrimary : theme.onSurface,
                  },
                  isActive ? styles.activePageText : styles.inactivePageText,
                ]}
                numberOfLines={1}
              >
                {pageName}
              </Text>
            </Pressable>
          );
        })}
      </Row>

      <Pressable
        style={[
          styles.button,
          styles.navButton,
          {
            borderColor: borderColor,
            backgroundColor: theme.surface,
          },
          !canGoNext && styles.disabledButton,
        ]}
        onPress={handleNext}
        disabled={!canGoNext}
        android_ripple={{ color: theme.rippleColor }}
      >
        <IconButton
          icon="chevron-right"
          iconColor={canGoNext ? theme.onSurface : theme.onSurfaceDisabled}
          size={20}
          style={styles.iconButton}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    minWidth: 40,
    paddingHorizontal: 12,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  ellipsisButton: {
    borderStyle: 'dashed',
  },
  ellipsisText: {
    fontSize: 16,
    fontWeight: '500',
  },
  iconButton: {
    margin: 0,
  },
  navButton: {
    paddingHorizontal: 0,
  },
  pageNumbersRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pageText: {
    fontSize: 15,
    letterSpacing: 0.15,
    maxWidth: 100,
  },
  activeButton: {
    borderColor: 'transparent',
  },
  inactiveButton: {
    borderColor: borderColor,
  },
  activePageText: {
    fontWeight: '600',
  },
  inactivePageText: {
    fontWeight: '400',
  },
});

export default PagePaginationControl;
