import React, { useState } from 'react';
import { DocumentActionComponent } from 'sanity';
import { TranslateIcon } from '@sanity/icons';
import { BaseTranslationWrapper } from '../components/shared/BaseTranslationWrapper';
import { TranslationsProvider } from '../components/TranslationsProvider';
import { TranslationView } from '../components/tab/TranslationView';

export const translateAction: DocumentActionComponent = (props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const document = props.draft || props.published;

  return {
    label: 'Translate',
    icon: TranslateIcon,
    tone: 'primary',
    onHandle: () => setDialogOpen(true),
    dialog: dialogOpen
      ? {
          type: 'dialog' as const,
          header: 'Translations',
          onClose: () => setDialogOpen(false),
          content: (
            <BaseTranslationWrapper showContainer={false}>
              <TranslationsProvider singleDocument={document}>
                <TranslationView />
              </TranslationsProvider>
            </BaseTranslationWrapper>
          ),
        }
      : null,
  };
};
