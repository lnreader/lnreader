import './mocks';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import Slider from '../Slider/Slider';

const mockUseTheme = jest.fn();

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockUseTheme(),
}));

describe('Slider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({
      primary: '#6750a4',
      onPrimary: '#ffffff',
      secondaryContainer: '#e8def8',
      onSecondaryContainer: '#1d192b',
      onSurface: '#1d1b20',
      inverseSurface: '#322f35',
      inverseOnSurface: '#f5eff7',
      rippleColor: 'rgba(103, 80, 164, 0.12)',
    });
  });

  const layoutSlider = () => {
    const slider = screen.getByTestId('slider');
    fireEvent(slider, 'layout', {
      nativeEvent: {
        layout: { width: 200, height: 48, x: 0, y: 0 },
      },
    });
    return slider;
  };

  it('exposes the current range to accessibility services', () => {
    render(
      <Slider value={4} min={0} max={10} accessibilityLabel="Reading size" />,
    );

    expect(screen.getByLabelText('Reading size')).toHaveAccessibilityValue({
      min: 0,
      max: 10,
      now: 4,
      text: '4',
    });
  });

  it('maps touch position to a stepped value', () => {
    const onValueChange = jest.fn();
    render(
      <Slider
        value={0}
        min={0}
        max={10}
        step={2}
        onValueChange={onValueChange}
      />,
    );
    const slider = layoutSlider();

    fireEvent(slider, 'responderGrant', {
      nativeEvent: { locationX: 142 },
      touchHistory: {
        indexOfSingleActiveTouch: -1,
        mostRecentTimeStamp: 0,
        numberActiveTouches: 0,
        touchBank: [],
      },
    });

    expect(onValueChange).toHaveBeenLastCalledWith(8);
  });

  it('uses the MD3 XS track, gap, and handle measurements by default', () => {
    render(<Slider value={5} min={0} max={10} />);
    layoutSlider();

    expect(screen.getByTestId('slider')).toHaveStyle({ height: 48 });
    expect(screen.getByTestId('slider-handle')).toHaveStyle({
      borderRadius: 2,
      height: 44,
      top: 2,
      width: 4,
    });
    expect(screen.getByTestId('slider-active-track')).toHaveStyle({
      borderTopLeftRadius: 8,
      borderTopRightRadius: 2,
      height: 16,
      top: 16,
      width: 92,
    });
    expect(screen.getByTestId('slider-inactive-track')).toHaveStyle({
      borderTopLeftRadius: 2,
      borderTopRightRadius: 8,
      height: 16,
      top: 16,
      width: 92,
    });
  });

  it('supports accessibility increment and decrement actions', () => {
    const onValueChange = jest.fn();
    render(
      <Slider
        value={4}
        min={0}
        max={10}
        step={2}
        onValueChange={onValueChange}
      />,
    );
    const slider = screen.getByTestId('slider');

    fireEvent(slider, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    fireEvent(slider, 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });

    expect(onValueChange).toHaveBeenNthCalledWith(1, 6);
    expect(onValueChange).toHaveBeenNthCalledWith(2, 2);
  });

  it('reports the final value when sliding completes', () => {
    const onSlidingComplete = jest.fn();
    render(
      <Slider
        value={0}
        min={0}
        max={10}
        step={1}
        onSlidingComplete={onSlidingComplete}
      />,
    );
    const slider = layoutSlider();
    const responderEvent = {
      nativeEvent: { locationX: 100 },
      touchHistory: {
        indexOfSingleActiveTouch: -1,
        mostRecentTimeStamp: 0,
        numberActiveTouches: 0,
        touchBank: [],
      },
    };

    fireEvent(slider, 'responderGrant', responderEvent);
    fireEvent(slider, 'responderRelease', responderEvent);

    expect(onSlidingComplete).toHaveBeenCalledWith(5);
  });

  it('does not respond while disabled', () => {
    const onValueChange = jest.fn();
    render(
      <Slider
        disabled
        value={4}
        min={0}
        max={10}
        onValueChange={onValueChange}
      />,
    );
    const slider = layoutSlider();

    fireEvent(slider, 'responderGrant', {
      nativeEvent: { locationX: 150 },
      touchHistory: {
        indexOfSingleActiveTouch: -1,
        mostRecentTimeStamp: 0,
        numberActiveTouches: 0,
        touchBank: [],
      },
    });
    fireEvent(slider, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
