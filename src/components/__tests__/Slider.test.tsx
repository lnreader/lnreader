import './mocks';
import { fireEvent, render, screen } from '@testing-library/react-native';

import Slider from '../Slider/Slider';

describe('Slider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes the current range to accessibility services', () => {
    render(<Slider value={4} min={0} max={10} />);

    expect(screen.getByRole('adjustable')).toHaveAccessibilityValue({
      min: 0,
      max: 10,
      now: 4,
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

    fireEvent(screen.getByRole('adjustable'), 'valueChange', 7.3);

    expect(onValueChange).toHaveBeenLastCalledWith(8);
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

    fireEvent(screen.getByRole('adjustable'), 'valueChange', 5);

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

    fireEvent(screen.getByRole('adjustable'), 'valueChange', 6);

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
