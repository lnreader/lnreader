import './mocks';
import { act, render, screen } from '@testing-library/react-native';

import Slider from '../Slider/Slider';

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({
    primary: '#6750a4',
    onPrimary: '#ffffff',
    secondaryContainer: '#e8def8',
    onSecondaryContainer: '#1d192b',
    onSurface: '#1d1b20',
  }),
}));

const nativeSlider = () => screen.getByTestId('native-slider');

const drag = (...values: number[]) =>
  act(() => {
    values.forEach(value => nativeSlider().props.onValueChange(value));
    nativeSlider().props.onValueChangeFinished();
  });

describe('Slider', () => {
  it('converts the step size into the number of Compose stops', () => {
    render(<Slider value={14} min={12} max={50} step={1} />);

    expect(nativeSlider().props.steps).toBe(37);
  });

  it('is continuous when no step is given', () => {
    render(<Slider value={0.5} />);

    expect(nativeSlider().props.steps).toBe(0);
  });

  it('snaps native float values onto the step grid', () => {
    const onValueChange = jest.fn();
    render(
      <Slider
        value={1}
        min={0.1}
        max={5}
        step={0.1}
        onValueChange={onValueChange}
      />,
    );

    drag(1.4000001, 1.41, 2.0999999);

    expect(onValueChange.mock.calls).toEqual([[1.4], [2.1]]);
  });

  it('reports the last dragged value when sliding completes', () => {
    const onSlidingComplete = jest.fn();
    render(
      <Slider
        value={14}
        min={12}
        max={50}
        step={1}
        onSlidingComplete={onSlidingComplete}
      />,
    );

    drag(20.2, 31.7);

    expect(onSlidingComplete).toHaveBeenCalledWith(32);
  });

  it('reports the controlled value after it changes externally', () => {
    const onSlidingComplete = jest.fn();
    const { rerender } = render(
      <Slider value={14} min={12} max={50} step={1} />,
    );
    rerender(
      <Slider
        value={18}
        min={12}
        max={50}
        step={1}
        onSlidingComplete={onSlidingComplete}
      />,
    );

    drag();

    expect(onSlidingComplete).toHaveBeenCalledWith(18);
  });

  it('disables the native slider and clamps out-of-range values', () => {
    render(<Slider disabled value={80} min={12} max={50} />);

    expect(nativeSlider().props.enabled).toBe(false);
    expect(nativeSlider().props.value).toBe(50);
  });
});
