import React from 'react';
import { useDocumentPane } from 'sanity/structure';
import { SanityDocument } from 'sanity';
import { BaseTranslationWrapper } from '../components/shared/BaseTranslationWrapper';
import { TranslationsProvider } from '../components/TranslationsProvider';
import { TranslationView } from '../components/tab/TranslationView';
import { DocumentInspectorHeader } from 'sanity/structure';
import { Box } from '@sanity/ui';

interface TranslationsInspectorProps {
  onClose: () => void;
}

export function TranslationsInspector({ onClose }: TranslationsInspectorProps) {
  const { displayed } = useDocumentPane();

  return (
    <>
      <DocumentInspectorHeader
        title='Translations'
        closeButtonLabel='Close translations panel'
        onClose={onClose}
      />
      <Box overflow='auto' padding={3}>
        <BaseTranslationWrapper showContainer={false}>
          <TranslationsProvider
            singleDocument={displayed as SanityDocument | null}
          >
            <TranslationView />
          </TranslationsProvider>
        </BaseTranslationWrapper>
      </Box>
    </>
  );
}

export const TRANSLATIONS_INSPECTOR_NAME = 'gt-translations';
