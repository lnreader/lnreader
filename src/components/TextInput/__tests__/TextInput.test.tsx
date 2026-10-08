import './mocks';
import { render, screen, fireEvent } from '@testing-library/react-native';
import TextInput from '../index';

describe('TextInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with placeholder', () => {
    render(
      <TextInput value="" onChangeText={() => {}} placeholder="Enter text" />,
    );
    expect(screen.getByText('Enter text')).toBeTruthy();
  });

  it('error state: shows the error below the field', () => {
    render(
      <TextInput
        value=""
        onChangeText={() => {}}
        placeholder="Test"
        error="Required"
      />,
    );
    expect(screen.getByText('Required')).toBeTruthy();
  });

  it('passes through other TextInput props (onChangeText)', () => {
    const onChangeText = jest.fn();
    render(
      <TextInput
        value=""
        placeholder="Test"
        onChangeText={onChangeText}
        testID="field"
      />,
    );

    fireEvent.changeText(screen.getByTestId('field'), 'new text');
    expect(onChangeText).toHaveBeenCalledWith('new text');
  });
});
