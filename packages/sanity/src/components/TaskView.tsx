// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { useCallback, useContext, useState, useEffect } from 'react';
import { Box, Button, Flex, Text, Stack, useToast, Switch } from '@sanity/ui';
import {
  ArrowTopRightIcon,
  DownloadIcon,
  CheckmarkCircleIcon,
} from '@sanity/icons';

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
  const [importedFiles, setImportedFiles] = useState<Set<string>>(new Set());

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

        setImportedFiles((prev) => new Set([...prev, localeId]));

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

  const checkAndImportCompletedFiles = useCallback(async () => {
    if (!autoImport || isBusy) return;

    const completedFiles = task.locales.filter(
      (locale) =>
        (locale.progress || 0) >= 100 && !importedFiles.has(locale.localeId)
    );

    if (completedFiles.length === 0) return;

    setIsBusy(true);
    try {
      for (const locale of completedFiles) {
        await importFile(locale.localeId);
      }
    } finally {
      setIsBusy(false);
    }
  }, [autoImport, isBusy, task.locales, importedFiles, importFile]);

  const handleRefreshClick = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await refreshTask();
    await checkAndImportCompletedFiles();
    setIsRefreshing(false);
  }, [refreshTask, setIsRefreshing, checkAndImportCompletedFiles]);

  const handleImportAll = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);

    try {
      const filesToImport = task.locales.filter(
        (locale) => !importedFiles.has(locale.localeId)
      );
      for (const locale of filesToImport) {
        await importFile(locale.localeId);
      }
    } finally {
      setIsBusy(false);
    }
  }, [task.locales, importFile, isBusy, importedFiles]);

  useEffect(() => {
    if (!autoRefresh || importedFiles.size === task.locales.length) return;

    const interval = setInterval(async () => {
      await handleRefreshClick();
    }, 5000);

    return () => clearInterval(interval);
  }, [
    handleRefreshClick,
    autoRefresh,
    importedFiles.size,
    task.locales.length,
  ]);

  useEffect(() => {
    checkAndImportCompletedFiles();
  }, [checkAndImportCompletedFiles, task.locales]);

  useEffect(() => {
    setImportedFiles((prev) => {
      const newSet = new Set<string>();
      for (const localeId of prev) {
        if (task.locales.some((locale) => locale.localeId === localeId)) {
          newSet.add(localeId);
        }
      }
      return newSet;
    });
  }, [task.locales]);

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
              isImported={importedFiles.has(localeTask.localeId)}
            />
          );
        })}
      </Box>
      <Stack space={3}>
        <Flex gap={3} align='center' justify='space-between'>
          <Flex gap={2} align='center'>
            <Button
              mode='ghost'
              onClick={handleImportAll}
              text={isBusy ? 'Importing...' : 'Import All'}
              icon={isBusy ? null : DownloadIcon}
              disabled={isBusy || importedFiles.size === task.locales.length}
            />
            {importedFiles.size === task.locales.length &&
              task.locales.length > 0 && (
                <Flex gap={2} align='center' style={{ color: 'green' }}>
                  <CheckmarkCircleIcon />
                  <Text size={1}>All translations imported</Text>
                </Flex>
              )}
            {importedFiles.size > 0 &&
              importedFiles.size < task.locales.length && (
                <Text size={1} style={{ color: '#666' }}>
                  {importedFiles.size}/{task.locales.length} imported
                </Text>
              )}
          </Flex>
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
