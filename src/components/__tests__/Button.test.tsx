import './mocks';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import Button from '../Button/Button';

const mockUseTheme = jest.fn();

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockUseTheme(),
}));

describe('Button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({
      primary: '#6200ee',
      background: '#ffffff',
      surface: '#f5f5f5',
      onPrimary: '#ffffff',
      onSurface: '#000000',
    });
  });

  it('renders with title prop', () => {
    render(<Button title="Click Me" onPress={() => {}} />);

    expect(screen.getByText('Click Me')).toBeTruthy();
  });

  it('renders with children', () => {
    render(
      <Button onPress={() => {}}>
        <Text>Child Text</Text>
      </Button>,
    );

    expect(screen.getByText('Child Text')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Button title="Click Me" onPress={onPress} />);

    fireEvent.press(screen.getByText('Click Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('prioritizes title over children', () => {
    render(
      <Button title="Title" onPress={() => {}}>
        <Text>Children</Text>
      </Button>,
    );

    expect(screen.getByText('Title')).toBeTruthy();
    expect(screen.queryByText('Children')).toBeNull();
  });

  it('uses theme from useTheme hook', () => {
    const { toJSON } = render(<Button title="Test" onPress={() => {}} />);

    expect(toJSON()).toBeTruthy();
  });

  it('renders the text variant by default', () => {
    render(<Button title="Click Me" onPress={() => {}} />);

    expect(screen.getByTestId('button-text')).toBeOnTheScreen();
  });

  it('renders the contained variant for mode="contained"', () => {
    render(<Button title="Click Me" mode="contained" onPress={() => {}} />);

    expect(screen.getByTestId('button-contained')).toBeOnTheScreen();
    expect(screen.getByTestId('button-contained').props.colors).toMatchObject({
      containerColor: mockUseTheme().primary,
    });
  });

  it('disables the button and stops onPress from firing', () => {
    const onPress = jest.fn();
    render(<Button title="Click Me" onPress={onPress} disabled />);

    const button = screen.getByTestId('button-text');
    expect(button.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
