import React from 'react';

import { getString } from '@i18n/translations';
import ReaderValueChange from './ReaderValueChange';

const TextSizeSlider: React.FC = () => (
  <ReaderValueChange
    label={getString('readerScreen.bottomSheet.textSize')}
    valueKey="textSize"
    valueChange={1}
    min={12}
    max={50}
    decimals={0}
    unit="px"
  />
);

export default TextSizeSlider;
