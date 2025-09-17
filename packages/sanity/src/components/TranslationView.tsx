/**
 * Add cleanup function to cancel async tasks
 */

import { useCallback, useContext, useEffect, useState } from 'react';
import { Stack, useToast } from '@sanity/ui';
import { TranslationContext } from './TranslationContext';

import { NewTask } from './NewTask';
import { TaskView } from './TaskView';
import { TranslationTask, TranslationLocale } from '../types';

export const TranslationView = () => {
  const [locales, setLocales] = useState<TranslationLocale[]>([]);
  const [task, setTask] = useState<TranslationTask | null>(null);

  const context = useContext(TranslationContext);
  const toast = useToast();

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
    await context?.adapter
      .getTranslationTask(context.documentInfo, context.secrets)
      .then(setTask);
  }, [context, setTask]);

  return (
    <Stack space={6}>
      <NewTask locales={locales} refreshTask={refreshTask} />
      {task && (
        <TaskView task={task} locales={locales} refreshTask={refreshTask} />
      )}
    </Stack>
  );
};
