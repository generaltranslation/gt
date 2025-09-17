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
    function fetchData() {
      if (!context) {
        toast.push({
          title: 'Unable to load translation data: missing context',
          status: 'error',
          closable: true,
        });
        return;
      }

      context.adapter
        .getLocales(context.secrets)
        .then(setLocales)
        .then(() =>
          context?.adapter.getTranslationTask(
            context.documentId,
            context.secrets
          )
        )
        .then(setTask)
        .catch((err) => {
          let errorMsg;
          if (err instanceof Error) {
            errorMsg = err.message;
          } else {
            errorMsg = err ? String(err) : null;
          }

          toast.push({
            title: `Error creating translation job`,
            description: errorMsg,
            status: 'error',
            closable: true,
          });
        });
    }

    fetchData();
  }, [context, toast]);

  const refreshTask = useCallback(async () => {
    await context?.adapter
      .getTranslationTask(context.documentId, context.secrets)
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
