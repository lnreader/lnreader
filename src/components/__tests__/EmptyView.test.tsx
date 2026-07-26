import './mocks';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import EmptyView from '../EmptyView';

const mockUseTheme = jest.fn();

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockUseTheme(),
}));

const mockTheme = {
  outline: '#999999',
};

describe('EmptyView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue(mockTheme);
  });

  it('renders icon and description', () => {
    render(<EmptyView icon="📚" description="No items found" />);

    expect(screen.getByText('📚')).toBeTruthy();
    expect(screen.getByText('No items found')).toBeTruthy();
  });

  it('renders children when provided', () => {
    render(
      <EmptyView icon="📚" description="No items found">
        <Text testID="child-component">Child Content</Text>
      </EmptyView>,
    );

    expect(screen.getByTestId('child-component')).toBeTruthy();
    expect(screen.getByText('Child Content')).toBeTruthy();
  });

  it('uses theme color for icon and text', () => {
    render(<EmptyView icon="📚" description="No items found" />);

    const icon = screen.getByText('📚');
    const description = screen.getByText('No items found');

    expect(icon.props.style).toContainEqual({ color: '#999999' });
    expect(description.props.style).toContainEqual({ color: '#999999' });
  });
});
