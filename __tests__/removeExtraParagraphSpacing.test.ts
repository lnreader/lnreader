import removeExtraParagraphSpacing from '../android/app/src/main/assets/js/removeExtraParagraphSpacing';

describe('removeExtraParagraphSpacing', () => {
  const testCases = [
    {
      id: '#1',
      input: '<p><br>aa<br></p>',
      expected: '<p>aa</p>',
    },
    {
      id: '#2',
      // ↓↓ \u200b zero width space
      input: '<p>bb<br>\u200b</p>',
      expected: '<p>bb</p>',
    },
    {
      id: '#3',
      input: '<p>cccc</p><br><br> <br> <p>ukauka</p>',
      expected: '<p>cccc</p><p>ukauka</p>',
    },
    {
      id: '#4',
      input: '<p>cccc</p><br> <br><p>ukauka</p>',
      expected: '<p>cccc</p><p>ukauka</p>',
    },
    {
      id: '#5',
      input: '<p>cccc</p><br> <p>ukauka</p>',
      expected: '<p>cccc</p><p>ukauka</p>',
    },
    {
      id: '#6',
      input: '<b>aa<br><br> bb<br><br><br>cc</b>',
      expected: '<b>aa<br><br> bb<br><br>cc</b>',
    },
    {
      id: '#7',
      input: '<p><span style="yes"><br>aa</span></p>',
      expected: '<p><span style="yes">aa</span></p>',
    },
  ];

  testCases.forEach(({ id, input, expected }) => {
    it(`should correctly transform case ${id}`, () => {
      const result = removeExtraParagraphSpacing(input);
      expect(result).toBe(expected);
    });
  });
});
