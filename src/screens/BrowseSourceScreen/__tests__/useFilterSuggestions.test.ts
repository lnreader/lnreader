import { act, renderHook } from '@testing-library/react-native';
import { getFilterSuggestions } from '@plugins/pluginManager';
import {
  clearFilterSuggestionsCache,
  FilterSuggestionsResult,
  useFilterSuggestions,
} from '../useFilterSuggestions';
import { FilterOption } from '@plugins/types/filterTypes';

jest.mock('@plugins/pluginManager', () => ({
  getFilterSuggestions: jest.fn(),
}));

const mockGetFilterSuggestions = jest.mocked(getFilterSuggestions);

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
};

const renderSuggestions = (
  query: string,
  onSelect: (option: FilterOption) => void = jest.fn(),
) =>
  renderHook<FilterSuggestionsResult, { query: string }>(
    ({ query: currentQuery }) =>
      useFilterSuggestions('plugin', 'genres', currentQuery, onSelect),
    { initialProps: { query } },
  );

const renderTarget = (pluginId: string, query: string, filterKey = 'genres') =>
  renderHook<
    FilterSuggestionsResult,
    { pluginId: string; filterKey: string; query: string }
  >(
    props =>
      useFilterSuggestions(
        props.pluginId,
        props.filterKey,
        props.query,
        jest.fn(),
      ),
    { initialProps: { pluginId, filterKey, query } },
  );

describe('useFilterSuggestions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetFilterSuggestions.mockReset();
    mockGetFilterSuggestions.mockResolvedValue([]);
    clearFilterSuggestionsCache();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not query the source below the minimum length', () => {
    const { result } = renderSuggestions('a');

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockGetFilterSuggestions).not.toHaveBeenCalled();
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('debounces input before querying the source', async () => {
    const suggestions = [{ label: 'Example', value: 'Example' }];
    mockGetFilterSuggestions.mockResolvedValue(suggestions);

    const { result, rerender } = renderSuggestions('ab');
    rerender({ query: 'abc' });

    expect(result.current.isLoading).toBe(true);
    expect(mockGetFilterSuggestions).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    expect(mockGetFilterSuggestions).toHaveBeenCalledTimes(1);
    expect(mockGetFilterSuggestions).toHaveBeenCalledWith(
      'plugin',
      'genres',
      'abc',
    );
    expect(result.current.suggestions).toEqual(suggestions);
    expect(result.current.isLoading).toBe(false);
  });

  it('discards a stale response that resolves after newer input', async () => {
    const first = deferred<{ label: string; value: string }[]>();
    const second = deferred<{ label: string; value: string }[]>();
    mockGetFilterSuggestions
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result, rerender } = renderSuggestions('ab');
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    rerender({ query: 'abc' });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    // The newer query is not blocked by the still-in-flight older one.
    expect(mockGetFilterSuggestions).toHaveBeenCalledTimes(2);

    await act(async () => {
      first.resolve([{ label: 'stale', value: 'stale' }]);
      await first.promise;
    });

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      second.resolve([{ label: 'fresh', value: 'fresh' }]);
      await second.promise;
    });

    expect(result.current.suggestions).toEqual([
      { label: 'fresh', value: 'fresh' },
    ]);
    expect(result.current.isLoading).toBe(false);
  });

  it('backs off progressively after a failure', async () => {
    mockGetFilterSuggestions.mockRejectedValueOnce(new Error('rate limited'));

    const { result, rerender } = renderSuggestions('ab');
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);

    rerender({ query: 'abc' });

    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(mockGetFilterSuggestions).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(mockGetFilterSuggestions).toHaveBeenCalledTimes(2);
  });

  it('serves repeated queries from the session cache', async () => {
    const suggestions = [{ label: 'Example', value: 'Example' }];
    mockGetFilterSuggestions.mockResolvedValue(suggestions);

    const { result, rerender } = renderSuggestions('ab');
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    rerender({ query: 'abc' });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(mockGetFilterSuggestions).toHaveBeenCalledTimes(2);

    rerender({ query: 'ab' });

    expect(result.current.suggestions).toEqual(suggestions);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(mockGetFilterSuggestions).toHaveBeenCalledTimes(2);
  });

  it('resets backoff when the target plugin changes', async () => {
    mockGetFilterSuggestions.mockRejectedValueOnce(new Error('rate limited'));

    const { rerender } = renderTarget('plugin-a', 'ab');
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(mockGetFilterSuggestions).toHaveBeenCalledTimes(1);

    rerender({ pluginId: 'plugin-b', filterKey: 'genres', query: 'ab' });

    // Backoff reset, so the new target uses the base debounce rather than 500ms.
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(mockGetFilterSuggestions).toHaveBeenCalledTimes(2);
    expect(mockGetFilterSuggestions).toHaveBeenLastCalledWith(
      'plugin-b',
      'genres',
      'ab',
    );
  });

  it('does not surface the previous target suggestions after a target change', async () => {
    mockGetFilterSuggestions
      .mockResolvedValueOnce([{ label: 'A', value: 'A' }])
      .mockResolvedValueOnce([{ label: 'B', value: 'B' }]);

    const { result, rerender } = renderTarget('plugin-a', 'ab');
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(result.current.suggestions).toEqual([{ label: 'A', value: 'A' }]);

    rerender({ pluginId: 'plugin-b', filterKey: 'genres', query: 'ab' });
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(result.current.suggestions).toEqual([{ label: 'B', value: 'B' }]);
  });

  it('times out a request that never settles and backs off', async () => {
    const pending = deferred<{ label: string; value: string }[]>();
    mockGetFilterSuggestions.mockImplementationOnce(() => pending.promise);

    const { result, rerender } = renderSuggestions('ab');
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(mockGetFilterSuggestions).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);

    // The timeout counts as a failure, so the next query waits 500ms.
    rerender({ query: 'abc' });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(mockGetFilterSuggestions).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(mockGetFilterSuggestions).toHaveBeenCalledTimes(2);
  });

  it('reveals suggestions only while the field is focused', async () => {
    mockGetFilterSuggestions.mockResolvedValue([{ label: 'A', value: 'A' }]);

    const { result } = renderSuggestions('ab');
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    expect(result.current.suggestions).toEqual([{ label: 'A', value: 'A' }]);
    expect(result.current.isVisible).toBe(false);

    act(() => result.current.onFocus());
    expect(result.current.isVisible).toBe(true);

    act(() => result.current.onBlur());
    expect(result.current.isVisible).toBe(false);
  });

  it('reports the selection and hides the list', async () => {
    const onSelect = jest.fn();
    mockGetFilterSuggestions.mockResolvedValue([{ label: 'A', value: 'A' }]);

    const { result } = renderSuggestions('ab', onSelect);
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    act(() => result.current.onFocus());

    act(() => result.current.select({ label: 'A', value: 'A' }));

    expect(onSelect).toHaveBeenCalledWith({ label: 'A', value: 'A' });
    expect(result.current.isVisible).toBe(false);
  });
});
