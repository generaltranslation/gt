// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

/**
 * Add cleanup function to cancel async tasks
 */

import { useCallback, useContext, useEffect, useState, useMemo } from 'react';
import { Stack, useToast, Text, Card } from '@sanity/ui';
import { TranslationContext } from './TranslationContext';
import { gtConfig } from '../adapter/core';

import { NewTask } from './NewTask';
import { TaskView } from './TaskView';
import { TranslationTask, TranslationLocale } from '../types';

export const TranslationView = () => {
  const [locales, setLocales] = useState<TranslationLocale[]>([]);
  const [task, setTask] = useState<TranslationTask | null>(null);

  const context = useContext(TranslationContext);
  const toast = useToast();

  // Extract the current document's language from the language field
  const currentDocumentLanguage = useMemo(() => {
    if (!context?.document || !context?.languageField) return null;

    // Get the language from the document's language field
    const documentLanguage = context.document[context.languageField];

    // If no language field is set, assume it's the source language
    return documentLanguage || gtConfig.getSourceLocale();
  }, [context?.document, context?.languageField]);

  // Only show translation components if we're on a source language document
  const shouldShowTranslationComponents = useMemo(() => {
    if (!currentDocumentLanguage) return false;
    return currentDocumentLanguage === gtConfig.getSourceLocale();
  }, [currentDocumentLanguage]);

  useEffect(() => {
    async function fetchData() {
      if (!context) {
        toast.push({
          title: 'Unable to load translation data: missing context',
          status: 'error',
          closable: true,
        });
        return;
      }

      const locales = await context.adapter.getLocales(context.secrets);
      setLocales(locales);
      try {
        const task = await context?.adapter.getTranslationTask(
          context.documentInfo,
          context.secrets
        );
        setTask(task);
      } catch (err) {
        let errorMsg;
        if (err instanceof Error) {
          errorMsg = err.message;
        } else {
          errorMsg = err ? String(err) : null;
        }

        // Hacky bypass for when a document is not yet translated and has never been uploaded
        if (errorMsg?.toLowerCase().includes('no source file found')) {
          return;
        }

        toast.push({
          title: `Error creating translation job`,
          description: errorMsg,
          status: 'error',
          closable: true,
        });
      }
    }

    fetchData();
  }, [context, toast]);

  const refreshTask = useCallback(async () => {
    const task = await context?.adapter.getTranslationTask(
      context.documentInfo,
      context.secrets
    );
    if (task) {
      setTask(task);
    }
  }, [context, setTask]);

  // Show message if we're not on a source language document
  if (!shouldShowTranslationComponents) {
    return (
      <Card padding={4} tone='neutral' border>
        <Text size={1} muted>
          Translation tools are only available for{' '}
          <code>{gtConfig.getSourceLocale()}</code> documents.
        </Text>
      </Card>
    );
  }

  return (
    <Stack space={6}>
      <NewTask locales={locales} refreshTask={refreshTask} />
      {task && (
        <TaskView task={task} locales={locales} refreshTask={refreshTask} />
      )}
    </Stack>
  );
};
