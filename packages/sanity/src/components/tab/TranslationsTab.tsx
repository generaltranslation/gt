// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import React from 'react';
import { SanityDocument } from 'sanity';
import { TranslationsTabConfigOptions } from '../../types';
import { BaseTranslationWrapper } from '../shared/BaseTranslationWrapper';
import { TranslationsProvider } from '../TranslationsProvider';
import { TranslationView } from './TranslationView';

type TranslationTabProps = {
  document: {
    displayed: SanityDocument;
  };
  options: TranslationsTabConfigOptions;
};

const TranslationTab = (props: TranslationTabProps) => {
  const { displayed } = props.document;
  const secretsNamespace = `${props.options.secretsNamespace || 'translationService'}.secrets`;

  return (
    <BaseTranslationWrapper
      secretsNamespace={secretsNamespace}
      showContainer={false}
    >
      <TranslationsProvider singleDocument={displayed}>
        <TranslationView />
      </TranslationsProvider>
    </BaseTranslationWrapper>
  );
};

export default TranslationTab;
