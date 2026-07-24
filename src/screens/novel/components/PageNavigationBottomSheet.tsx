import React from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import {
  BottomSheetView,
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import {
  LegendList,
  LegendListRenderItemProps,
} from '@legendapp/list/react-native';
import color from 'color';

import BottomSheet from '@components/BottomSheet/BottomSheet';
import { ThemeColors } from '@theme/types';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';

interface PageNavigationBottomSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetModalMethods | null>;
  theme: ThemeColors;
  pages: string[];
  pageIndex: number;
  openPage: (index: number) => void;
}

export default function PageNavigationBottomSheet({
  bottomSheetRef,
  theme,
  pages,
  pageIndex,
  openPage,
}: PageNavigationBottomSheetProps) {
  const BottomSheetLegendListScrollable = useBottomSheetScrollableCreator();

  const renderItem = ({ item, index }: LegendListRenderItemProps<string>) => {
    const isSelected = index === pageIndex;
    return (
      <View
        style={[
          styles.pageItemContainer,
          isSelected && {
            backgroundColor: theme.isDark
              ? color(theme.primary).alpha(0.2).string()
              : color(theme.primaryContainer).alpha(0.5).string(),
          },
        ]}
      >
        <Pressable
          android_ripple={{
            color: isSelected
              ? color(theme.primary).alpha(0.2).string()
              : theme.rippleColor,
          }}
          style={styles.pageItem}
          onPress={() => {
            openPage(index);
            bottomSheetRef.current?.close();
          }}
        >
          <View style={styles.pageItemContent}>
            <Text
              style={[
                styles.pageText,
                {
                  color: isSelected ? theme.primary : theme.onSurfaceVariant,
                },
              ]}
            >
              Page {item}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <BottomSheet
      bottomSheetRef={bottomSheetRef}
      snapPoints={[Math.min(400, pages.length * 56 + 100)]}
    >
      <BottomSheetView style={styles.contentContainer}>
        <LegendList
          data={pages}
          recycleItems
          extraData={pageIndex}
          renderItem={renderItem}
          keyExtractor={(item, index) => `page_${index}_${item}`}
          estimatedItemSize={56}
          contentContainerStyle={styles.listContent}
          renderScrollComponent={BottomSheetLegendListScrollable}
        />
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    maxHeight: 400,
  },
  listContent: {
    paddingBottom: 8,
    paddingTop: 4,
  },
  pageItem: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  pageItemContainer: {
    borderRadius: 0,
    marginHorizontal: 0,
    overflow: 'hidden',
  },
  pageItemContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pageText: {},
  selectedIndicator: {
    borderRadius: 2,
    height: 20,
    width: 3,
  },
});
