import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Box, RNHostView } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  onSizeChanged,
  type ModifierConfig,
} from '@expo/ui/jetpack-compose/modifiers';

// The host follows the content's size, so the content is given the
// container's width once Compose has measured it.
const RNContent = ({
  children,
  modifiers = [],
}: {
  children: ReactNode;
  modifiers?: ModifierConfig[];
}) => {
  const [width, setWidth] = useState<number>();
  return (
    <Box
      modifiers={[
        fillMaxWidth(),
        onSizeChanged(size => setWidth(size.width)),
        ...modifiers,
      ]}
    >
      {width ? (
        <RNHostView matchContents>
          <View style={{ width }}>{children}</View>
        </RNHostView>
      ) : null}
    </Box>
  );
};

export default RNContent;
