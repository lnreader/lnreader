import { Text, type TextProps } from '@expo/ui/jetpack-compose';

type TextStyle = NonNullable<TextProps['style']>;
type TypographyStyle = NonNullable<TextStyle['typography']>;

export type TextVariant = TypographyStyle;

export interface AppTextProps extends Omit<TextProps, 'style'> {
  variant?: TextVariant;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  style?: Omit<TextStyle, 'typography'>;
}

const AppText = ({
  variant = 'bodyLarge',
  weight,
  align,
  style,
  overflow,
  maxLines,
  ...props
}: AppTextProps) => (
  <Text
    {...props}
    maxLines={maxLines}
    overflow={overflow ?? (maxLines ? 'ellipsis' : undefined)}
    style={{
      typography: variant,
      fontWeight: weight,
      textAlign: align,
      ...style,
    }}
  />
);

export default AppText;
