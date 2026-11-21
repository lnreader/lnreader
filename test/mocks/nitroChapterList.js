// Native chapter list (modules/nitro-chapter-list): a fake store that records
// calls, and a View standing in for the Fabric component so tests can fire its
// events (fireEvent(list, 'chapterPress', { nativeEvent: { id } })).
jest.mock('@modules/nitro-chapter-list', () => {
  const React = require('react');
  const { View } = require('react-native');
  let nextStoreId = 0;

  const createChapterListStore = jest.fn(() => {
    nextStoreId += 1;
    return {
      id: `mock-chapter-list-store-${nextStoreId}`,
      reset: jest.fn(),
      setRows: jest.fn(),
      updateRows: jest.fn(),
      setSelected: jest.fn(),
      setDownloading: jest.fn(),
    };
  });

  const ChapterListViewNativeComponent = React.forwardRef((props, ref) =>
    React.createElement(View, {
      ...props,
      ref,
      testID: props.testID ?? 'native-chapter-list',
    }),
  );

  return {
    __esModule: true,
    createChapterListStore,
    ChapterListViewNativeComponent,
    ChapterListViewCommands: {
      scrollToIndex: jest.fn(),
      scrollToOffset: jest.fn(),
    },
  };
});
