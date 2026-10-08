import { ThemeColors } from '@theme/types';
import React, { createContext, useContext } from 'react';
import { RadioButton as RadioButtonItem } from './RadioButton/RadioButton';

interface RadioButtonGroupProps {
  children?: React.ReactNode;
  value: string | number;
  onValueChange: (value: string) => void;
}

interface RadioButtonProps {
  value: string | number;
  label: string;
  theme: ThemeColors;
}

const RadioButtonGroupContext = createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

export const RadioButtonGroup = ({
  children,
  value,
  onValueChange,
}: RadioButtonGroupProps) => (
  <RadioButtonGroupContext.Provider
    value={{ value: String(value), onValueChange }}
  >
    {children}
  </RadioButtonGroupContext.Provider>
);

export const RadioButton = ({ value, label, theme }: RadioButtonProps) => {
  const group = useContext(RadioButtonGroupContext);
  return (
    <RadioButtonItem
      label={label}
      status={group?.value === String(value)}
      onPress={() => group?.onValueChange(String(value))}
      theme={theme}
    />
  );
};
