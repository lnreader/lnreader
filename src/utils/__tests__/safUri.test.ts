import { toSafDocumentUri } from '../../../modules/native-file/safUri';

describe('toSafDocumentUri', () => {
  it('converts a SAF virtual file path into a readable document URI', () => {
    expect(
      toSafDocumentUri(
        'content://com.android.externalstorage.documents/tree/primary%3ALNReader/Novels/plugin/42/cover.png',
      ),
    ).toBe(
      'content://com.android.externalstorage.documents/tree/primary%3ALNReader/document/primary%3ALNReader%2FNovels%2Fplugin%2F42%2Fcover.png',
    );
  });

  it('handles denormalized tree IDs returned by react-native-saf-x', () => {
    expect(
      toSafDocumentUri(
        'content://com.android.externalstorage.documents/tree/primary:LNReader/Novels/cover.png',
      ),
    ).toBe(
      'content://com.android.externalstorage.documents/tree/primary%3ALNReader/document/primary%3ALNReader%2FNovels%2Fcover.png',
    );
  });

  it('leaves an existing document URI unchanged', () => {
    const uri =
      'content://com.android.externalstorage.documents/tree/primary%3ALNReader/document/primary%3ALNReader%2FNovels%2Fcover.png';

    expect(toSafDocumentUri(uri)).toBe(uri);
  });
});
