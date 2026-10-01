import React, { memo } from 'react';
import { Column, Row } from '@expo/ui/jetpack-compose';
import { padding } from '@expo/ui/jetpack-compose/modifiers';
import { DisplayModes } from '@screens/library/constants/constants';
import ShimmerPlaceholder from '@components/Skeleton/ShimmerPlaceholder';

interface Props {
  availableWidth: number;
  backgroundColor: string;
  disableLoadingAnimations: boolean;
  highlightColor: string;
  pictureHeight: number;
  pictureWidth: number;
  displayMode: DisplayModes;
}

const LoadingNovel: React.FC<Props> = ({
  availableWidth,
  backgroundColor,
  disableLoadingAnimations,
  pictureHeight,
  pictureWidth,
  displayMode,
}) => {
  const showTitle =
    displayMode !== DisplayModes.CoverOnly &&
    displayMode !== DisplayModes.Compact;

  if (displayMode !== DisplayModes.List) {
    return (
      <Column modifiers={[padding(4.8, 4.8, 4.8, 8.8)]}>
        <ShimmerPlaceholder
          shimmerColors={[backgroundColor]}
          height={pictureHeight}
          width={pictureWidth}
          stopAutoRun={disableLoadingAnimations}
        />
        {showTitle ? (
          <>
            <ShimmerPlaceholder
              modifiers={[padding(0, 5, 0, 0)]}
              corner={8}
              shimmerColors={[backgroundColor]}
              height={16}
              width={pictureWidth}
              stopAutoRun={disableLoadingAnimations}
            />
            <ShimmerPlaceholder
              modifiers={[padding(0, 5, 0, 0)]}
              corner={8}
              shimmerColors={[backgroundColor]}
              height={16}
              width={pictureWidth * 0.68}
              stopAutoRun={disableLoadingAnimations}
            />
          </>
        ) : null}
      </Column>
    );
  }

  const chapterNumberWidth = 40;
  const textWidth = Math.max(80, availableWidth - chapterNumberWidth - 88);
  return (
    <Row verticalAlignment="center" modifiers={[padding(8, 8, 8, 8)]}>
      <ShimmerPlaceholder
        shimmerColors={[backgroundColor]}
        height={40}
        width={40}
        stopAutoRun={disableLoadingAnimations}
      />
      <ShimmerPlaceholder
        modifiers={[padding(16, 0, 8, 0)]}
        shimmerColors={[backgroundColor]}
        height={18}
        width={textWidth}
        stopAutoRun={disableLoadingAnimations}
      />
      <ShimmerPlaceholder
        shimmerColors={[backgroundColor]}
        height={20}
        width={chapterNumberWidth}
        stopAutoRun={disableLoadingAnimations}
      />
    </Row>
  );
};

export default memo(LoadingNovel);
