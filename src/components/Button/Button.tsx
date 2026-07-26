import React from 'react';
import {
  Button as PaperButton,
  ButtonProps as PaperButtonProps,
} from 'react-native-paper';

import { useTheme } from '@hooks/persisted';
import { ThemeProp } from 'react-native-paper/lib/typescript/types';

interface ButtonProps extends Partial<PaperButtonProps> {
  title?: string;
}

const Button: React.FC<ButtonProps> = props => {
  const t = useTheme();
  const theme: ThemeProp = React.useMemo(() => ({ colors: t }), [t]);
  const Children = React.useMemo(
    () => props.title || props.children,
    [props.children, props.title],
  );

  return (
    <PaperButton {...props} theme={theme}>
      {Children}
    </PaperButton>
  );
};

export default React.memo(Button);
