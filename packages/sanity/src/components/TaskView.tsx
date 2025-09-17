import { useCallback, useContext, useState, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  Text,
  Stack,
  useToast,
  Spinner,
  Switch,
} from '@sanity/ui';
import { ArrowTopRightIcon, DownloadIcon } from '@sanity/icons';

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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [autoImport, setAutoImport] = useState(true);
  const [hasImportedOnComplete, setHasImportedOnComplete] = useState(false);

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
          task.document,
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
    [locales, context, task.document, toast]
  );

  const handleRefreshClick = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await refreshTask();
    setIsRefreshing(false);
  }, [refreshTask, setIsRefreshing]);

  const allProgress =
    task.locales.reduce((acc, locale) => acc + (locale.progress || 0), 0) /
    task.locales.length;

  const handleImportAll = useCallback(async () => {
    if (isBusy || allProgress < 100) return;
    setIsBusy(true);

    try {
      await Promise.all(
        task.locales.map((locale) => importFile(locale.localeId))
      );
      setHasImportedOnComplete(true);
    } finally {
      setIsBusy(false);
    }
  }, [task.locales, importFile, isBusy, allProgress]);

  useEffect(() => {
    if (!autoRefresh || hasImportedOnComplete) return;

    const interval = setInterval(() => {
      handleRefreshClick();
    }, 5000);

    return () => clearInterval(interval);
  }, [handleRefreshClick, autoRefresh]);

  useEffect(() => {
    if (!autoImport || isBusy || allProgress < 100 || hasImportedOnComplete)
      return;

    handleImportAll();
  }, [autoImport, allProgress, handleImportAll, isBusy, hasImportedOnComplete]);

  useEffect(() => {
    if (allProgress < 100) {
      setHasImportedOnComplete(false);
    }
  }, [allProgress]);

  return (
    <Stack space={4}>
      <Flex align='center' justify='space-between'>
        <Text as='h2' weight='semibold' size={2}>
          Translation Progress
        </Text>

        <Flex gap={3} align='center'>
          <Flex gap={2} align='center'>
            <Text size={1}>Auto-refresh</Text>
            <Switch
              checked={autoRefresh}
              onChange={() => setAutoRefresh(!autoRefresh)}
            />
          </Flex>
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
            text='Refresh Status'
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
              key={[task.document.documentId, localeTask.localeId].join('.')}
              importFile={async () => {
                await importFile(localeTask.localeId);
              }}
              title={locale?.description || localeTask.localeId}
              progress={reportPercent}
            />
          );
        })}
      </Box>
      <Stack space={3}>
        <Flex gap={3} align='center' justify='space-between'>
          <Button
            mode='ghost'
            onClick={handleImportAll}
            text={isBusy ? 'Importing...' : 'Import All'}
            icon={isBusy ? null : DownloadIcon}
            disabled={isBusy || !allProgress || allProgress < 100}
          />
          <Flex gap={2} align='center' style={{ whiteSpace: 'nowrap' }}>
            <Text size={1}>Auto-import when complete</Text>
            <Switch
              checked={autoImport}
              onChange={() => setAutoImport(!autoImport)}
              disabled={isBusy}
            />
          </Flex>
        </Flex>
      </Stack>
    </Stack>
  );
};
