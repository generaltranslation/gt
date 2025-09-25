import React from 'react';
import { SanityDocument } from 'sanity';
import { BaseTranslationWrapper } from '../shared/BaseTranslationWrapper';
import { TranslationsProvider } from '../TranslationsProvider';
import { TranslationView } from './TranslationView';

type TranslationTabProps = {
  document: {
    displayed: SanityDocument;
  };
};

const TranslationTab = (props: TranslationTabProps) => {
  const { displayed } = props.document;

  return (
    <BaseTranslationWrapper showContainer={false}>
      <TranslationsProvider singleDocument={displayed}>
        <TranslationView />
      </TranslationsProvider>
    </BaseTranslationWrapper>
  );
};

export default TranslationTab;
