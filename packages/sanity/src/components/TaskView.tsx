import { useCallback, useContext, useState, useEffect } from 'react';
import { Box, Button, Flex, Text, Stack, useToast } from '@sanity/ui';
import { ArrowTopRightIcon } from '@sanity/icons';

import { TranslationContext } from './TranslationContext';
import { TranslationLocale, TranslationTask } from '../types';
import { LanguageStatus } from './LanguageStatus';

type JobProps = {
  task: TranslationTask;
  locales: TranslationLocale[];
  refreshTask: () => Promise<void>;
};

const getLocale = (
  localeId: string,
  locales: TranslationLocale[]
): TranslationLocale | undefined =>
  locales.find((l) => l.localeId === localeId);

export const TaskView = ({ task, locales, refreshTask }: JobProps) => {
  const context = useContext(TranslationContext);
  const toast = useToast();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const importFile = useCallback(
    async (localeId: string) => {
      if (!context) {
        toast.push({
          title:
            'Missing context, unable to import translation. Try refreshing or clicking away from this tab and back.',
          status: 'error',
          closable: true,
        });
        return;
      }

      const locale = getLocale(localeId, locales);
      const localeTitle = locale?.description || localeId;

      try {
        const translation = await context.adapter.getTranslation(
          task.taskId,
          localeId,
          context.secrets
        );

        const sanityId = context.localeIdAdapter
          ? await context.localeIdAdapter(localeId)
          : localeId;

        await context.importTranslation(sanityId, translation);

        toast.push({
          title: `Imported ${localeTitle} translation`,
          status: 'success',
          closable: true,
        });
      } catch (err) {
        let errorMsg;
        if (err instanceof Error) {
          errorMsg = err.message;
        } else {
          errorMsg = err ? String(err) : null;
        }

        toast.push({
          title: `Error getting ${localeTitle} translation`,
          description: errorMsg,
          status: 'error',
          closable: true,
        });
      }
    },
    [locales, context, task.taskId, toast]
  );

  const handleRefreshClick = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await refreshTask();
    setIsRefreshing(false);
  }, [refreshTask, setIsRefreshing]);

  useEffect(() => {
    const interval = setInterval(() => {
      handleRefreshClick();
    }, 5000);

    return () => clearInterval(interval);
  }, [handleRefreshClick]);

  return (
    <Stack space={4}>
      <Flex align='center' justify='space-between'>
        <Text as='h2' weight='semibold' size={2}>
          Current Job Progress
        </Text>

        <Flex gap={3}>
          {task.linkToVendorTask && (
            <Button
              as='a'
              text='View Job'
              iconRight={ArrowTopRightIcon}
              href={task.linkToVendorTask}
              target='_blank'
              rel='noreferrer noopener'
              fontSize={1}
              padding={2}
              mode='bleed'
            />
          )}
          <Button
            fontSize={1}
            padding={2}
            text={isRefreshing ? 'Refreshing' : 'Refresh Status'}
            onClick={handleRefreshClick}
            disabled={isRefreshing}
          />
        </Flex>
      </Flex>

      <Box>
        {task.locales.map((localeTask) => {
          const reportPercent = localeTask.progress || 0;
          const locale = getLocale(localeTask.localeId, locales);
          return (
            <LanguageStatus
              key={[task.taskId, localeTask.localeId].join('.')}
              importFile={async () => {
                await importFile(localeTask.localeId);
              }}
              title={locale?.description || localeTask.localeId}
              progress={reportPercent}
            />
          );
        })}
      </Box>
    </Stack>
  );
};
