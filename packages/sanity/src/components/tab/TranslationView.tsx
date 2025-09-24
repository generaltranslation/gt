// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

/**
 * Add cleanup function to cancel async tasks
 */

import { useMemo } from 'react';
import { Stack, Text, Card } from '@sanity/ui';
import { pluginConfig } from '../../adapter/core';
import { useTranslations } from '../TranslationsProvider';

import { NewTask } from './NewTask';
import { TaskView } from './TaskView';

export const TranslationView = () => {
  const { documents, locales, currentTask } = useTranslations();

  // Get the single document (first document in single document mode)
  const document = documents[0];

  // Extract the current document's language from the language field
  const currentDocumentLanguage = useMemo(() => {
    if (!document) return null;

    // Get the language from the document's language field
    const languageField = pluginConfig.getLanguageField();
    const documentLanguage = document[languageField];

    // If no language field is set, assume it's the source language
    return documentLanguage || pluginConfig.getSourceLocale();
  }, [document]);

  // Only show translation components if we're on a source language document
  const shouldShowTranslationComponents = useMemo(() => {
    if (!currentDocumentLanguage) return false;
    return currentDocumentLanguage === pluginConfig.getSourceLocale();
  }, [currentDocumentLanguage]);

  // Show message if we're not on a source language document
  if (!shouldShowTranslationComponents) {
    return (
      <Card padding={4} tone='neutral' border>
        <Text size={1} muted>
          Translation tools are only available for{' '}
          <code>{pluginConfig.getSourceLocale()}</code> documents.
        </Text>
      </Card>
    );
  }

  return (
    <Stack space={6} padding={4}>
      <NewTask locales={locales} />
      {currentTask && <TaskView task={currentTask} locales={locales} />}
    </Stack>
  );
};
