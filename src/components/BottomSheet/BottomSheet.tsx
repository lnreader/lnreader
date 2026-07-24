import React, { RefObject, useCallback, useMemo, useRef } from 'react';
import {
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBackHandler } from '@hooks/index';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import BottomSheetBackdrop from './BottomSheetBackdrop';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '@hooks/persisted';
import { getBottomSheetLayout, normalizeBottomSheetSnapPoints } from './layout';

interface BottomSheetProps
  extends Omit<
    BottomSheetModalProps,
    | 'backgroundComponent'
    | 'backgroundStyle'
    | 'backdropComponent'
    | 'bottomInset'
    | 'containerStyle'
    | 'enableDynamicSizing'
    | 'enableOverDrag'
    | 'enablePanDownToClose'
    | 'handleComponent'
    | 'handleIndicatorStyle'
    | 'handleStyle'
    | 'onChange'
    | 'ref'
    | 'snapPoints'
    | 'style'
    | 'topInset'
  > {
  bottomSheetRef: RefObject<BottomSheetModalMethods | null>;
  onChange?: (index: number) => void;
  snapPoints?: number[];
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  bottomSheetRef,
  children,
  onChange,
  snapPoints,
  ...otherProps
}) => {
  const indexRef = useRef<number>(null);
  const { bottom, top } = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const theme = useTheme();
  const { horizontalInset, maxHeight, topMargin } = getBottomSheetLayout({
    bottom,
    height,
    top,
    width,
  });
  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...backdropProps} />
    ),
    [],
  );
  useBackHandler(() => {
    if (typeof indexRef.current === 'number' && indexRef.current !== -1) {
      bottomSheetRef?.current?.close();
      return true;
    }
    return false;
  });

  const safeSnapPoints = useMemo(() => {
    return normalizeBottomSheetSnapPoints(snapPoints, maxHeight);
  }, [maxHeight, snapPoints]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      backdropComponent={renderBackdrop}
      handleComponent={null}
      backgroundStyle={[
        styles.modal,
        {
          backgroundColor: theme.surfaceContainerLow ?? theme.surface,
        },
      ]}
      containerStyle={{
        paddingBottom: bottom,
        paddingHorizontal: horizontalInset,
      }}
      onChange={index => {
        onChange?.(index);
        indexRef.current = index;
      }}
      enableDynamicSizing={false}
      enableOverDrag={false}
      enablePanDownToClose
      topInset={top + topMargin}
      snapPoints={safeSnapPoints}
      {...otherProps}
    >
      {children}
    </BottomSheetModal>
  );
};

export default React.memo(BottomSheet);

const styles = StyleSheet.create({
  modal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
});
