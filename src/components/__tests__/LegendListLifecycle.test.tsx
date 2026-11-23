import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { LegendList } from '@legendapp/list/react-native';

const renderItem = ({ item }: { item: string }) => <Text>{item}</Text>;

describe('LegendList render lifecycle', () => {
  it('does not update its container layer while rendering fresh data', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const view = render(
      <LegendList
        data={['first']}
        estimatedItemSize={40}
        recycleItems={false}
        renderItem={renderItem}
      />,
    );

    view.rerender(
      <LegendList
        data={[]}
        estimatedItemSize={40}
        recycleItems={false}
        renderItem={renderItem}
      />,
    );
    view.rerender(
      <LegendList
        data={['second']}
        estimatedItemSize={40}
        recycleItems={false}
        renderItem={renderItem}
      />,
    );

    expect(consoleError.mock.calls.flat().join(' ')).not.toContain(
      'Cannot update a component',
    );
  });
});
