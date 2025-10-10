// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

/**
 * Add cleanup function to cancel async tasks
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Stack,
  Text,
  Card,
  Button,
  Grid,
  Box,
  Flex,
  Switch,
  Tooltip,
  useToast,
} from '@sanity/ui';
import { pluginConfig } from '../../adapter/core';
import { useTranslations } from '../TranslationsProvider';
import { LanguageStatus } from '../shared/LanguageStatus';
import { LocaleCheckbox } from '../shared/LocaleCheckbox';
import { DownloadIcon, LinkIcon, PublishIcon } from '@sanity/icons';

export const TranslationView = () => {
  const {
    documents,
    locales,
    translationStatuses,
    isBusy,
    handleTranslateAll,
    handleImportDocument,
    handleRefreshAll,
    isRefreshing,
    importedTranslations,
    setLocales,
    handlePatchDocumentReferences,
    handlePublishAllTranslations,
  } = useTranslations();

  const [autoImport, setAutoImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [autoPatchReferences, setAutoPatchReferences] = useState(true);
  const [autoPublish, setAutoPublish] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  const toast = useToast();

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

  // Get available locales (excluding source locale)
  const availableLocales = useMemo(() => {
    const sourceLocale = pluginConfig.getSourceLocale();
    return locales.filter(
      (locale) => locale.enabled !== false && locale.localeId !== sourceLocale
    );
  }, [locales]);

  // Get document ID for status tracking
  const documentId = useMemo(() => {
    if (!document) return null;
    return document._id?.replace('drafts.', '') || document._id;
  }, [document]);

  // Unified import functionality
  const handleImportTranslations = useCallback(
    async (options: { autoOnly?: boolean } = {}) => {
      const { autoOnly = false } = options;

      // Check preconditions
      if (isImporting || !documentId) return;
      if (autoOnly && !autoImport) return;

      // Find translations ready to import
      const readyTranslations = availableLocales.filter((locale) => {
        const key = `${documentId}:${locale.localeId}`;
        const status = translationStatuses.get(key);
        return status?.isReady && !importedTranslations.has(key);
      });

      if (readyTranslations.length === 0) return;

      setIsImporting(true);
      try {
        // Import all ready translations
        await Promise.all(
          readyTranslations.map((locale) =>
            handleImportDocument(documentId, locale.localeId)
          )
        );

        // Auto patch document references if enabled
        if (autoPatchReferences) {
          await handlePatchDocumentReferences();
        }

        // Auto publish translations if enabled
        if (autoPublish) {
          await handlePublishAllTranslations();
        }
      } finally {
        setIsImporting(false);
      }
    },
    [
      autoImport,
      isImporting,
      documentId,
      availableLocales,
      translationStatuses,
      importedTranslations,
      handleImportDocument,
      autoPatchReferences,
      handlePatchDocumentReferences,
      autoPublish,
      handlePublishAllTranslations,
      toast,
    ]
  );

  // Check for completed translations on status updates (auto-import)
  useEffect(() => {
    handleImportTranslations({ autoOnly: true });
  }, [handleImportTranslations]);

  // Auto refresh functionality
  useEffect(() => {
    if (!autoRefresh || !documentId || availableLocales.length === 0) return;

    const interval = setInterval(async () => {
      await handleRefreshAll();
      await handleImportTranslations({ autoOnly: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [
    autoRefresh,
    documentId,
    availableLocales.length,
    handleRefreshAll,
    handleImportTranslations,
  ]);

  useEffect(() => {
    const initialRefresh = async () => {
      await handleRefreshAll();
      await handleImportTranslations({ autoOnly: true });
    };
    initialRefresh();
  }, []);

  // Locale toggle functionality
  const toggleLocale = useCallback(
    (localeId: string, shouldEnable: boolean) => {
      const updatedLocales = locales.map((locale) =>
        locale.localeId === localeId
          ? { ...locale, enabled: shouldEnable }
          : locale
      );
      setLocales(updatedLocales);
    },
    [locales, setLocales]
  );

  const toggleAllLocales = useCallback(() => {
    const sourceLocale = pluginConfig.getSourceLocale();
    const nonSourceLocales = locales.filter(
      (locale) => locale.localeId !== sourceLocale
    );
    const allEnabled = nonSourceLocales.every(
      (locale) => locale.enabled === true || locale.enabled === undefined
    );

    const updatedLocales = locales.map((locale) =>
      locale.localeId === sourceLocale
        ? locale // Don't change source locale
        : { ...locale, enabled: !allEnabled }
    );
    setLocales(updatedLocales);
  }, [locales, setLocales]);

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
      {/* Generate Translations Section */}
      <Stack space={4}>
        <Text as='h2' weight='semibold' size={2}>
          Generate Translations
        </Text>

        {/* Locale Selection */}
        <Stack space={3}>
          <Flex align='center' justify='space-between'>
            <Text weight='semibold' size={1}>
              {availableLocales.length === 1
                ? 'Select locale'
                : 'Select locales'}
            </Text>
            <Button
              fontSize={1}
              padding={2}
              text='Toggle All'
              onClick={toggleAllLocales}
            />
          </Flex>

          <Grid columns={[1, 1, 2, 3]} gap={1}>
            {locales
              .filter(
                (locale) => locale.localeId !== pluginConfig.getSourceLocale()
              )
              .map((locale) => (
                <LocaleCheckbox
                  key={locale.localeId}
                  locale={locale}
                  toggle={toggleLocale}
                  checked={
                    locale.enabled === true || locale.enabled === undefined
                  }
                />
              ))}
          </Grid>
        </Stack>

        <Button
          onClick={() => {
            setAutoImport(true);
            handleTranslateAll();
          }}
          disabled={isBusy || !availableLocales.length}
          tone='positive'
          text={isBusy ? 'Creating translations...' : 'Generate Translations'}
        />
      </Stack>

      {/* Translation Status Section */}
      {documentId && availableLocales.length > 0 && (
        <Stack space={4}>
          <Flex align='center' justify='space-between'>
            <Text as='h2' weight='semibold' size={2}>
              Translation Status
            </Text>
            <Flex gap={3} align='center'>
              <Flex gap={2} align='center'>
                <Text size={1}>Auto-refresh</Text>
                <Switch
                  checked={autoRefresh}
                  onChange={() => setAutoRefresh(!autoRefresh)}
                />
              </Flex>
              <Button
                fontSize={1}
                padding={2}
                text='Refresh Status'
                onClick={handleRefreshAll}
                disabled={isRefreshing}
              />
            </Flex>
          </Flex>

          <Box>
            {availableLocales.map((locale) => {
              const key = `${documentId}:${locale.localeId}`;
              const status = translationStatuses.get(key);
              const progress = status?.progress || 0;
              const isImported = importedTranslations.has(key);

              return (
                <LanguageStatus
                  key={key}
                  title={locale.description}
                  progress={progress}
                  isImported={isImported}
                  importFile={async () => {
                    if (!isImported && status?.isReady) {
                      await handleImportDocument(documentId, locale.localeId);
                    }
                  }}
                />
              );
            })}
          </Box>

          {/* Import Controls */}
          <Stack space={3}>
            <Flex gap={3} align='center' justify='space-between'>
              <Flex gap={2} align='center'>
                <Button
                  mode='ghost'
                  tone='primary'
                  onClick={() => handleImportTranslations()}
                  text={isImporting ? 'Importing...' : 'Import All'}
                  icon={DownloadIcon}
                  disabled={
                    isImporting ||
                    availableLocales.every((locale) => {
                      const key = `${documentId}:${locale.localeId}`;
                      const status = translationStatuses.get(key);
                      return !status?.isReady || importedTranslations.has(key);
                    })
                  }
                  style={{ minWidth: '180px' }}
                />
                <Flex gap={2} align='center'>
                  <Switch
                    checked={autoImport}
                    onChange={() => setAutoImport(!autoImport)}
                    disabled={isImporting}
                  />
                  <Text size={1}>Auto-import when complete</Text>
                </Flex>
              </Flex>
              <Text size={1} muted>
                Imported{' '}
                {
                  availableLocales.filter((locale) => {
                    const key = `${documentId}:${locale.localeId}`;
                    return importedTranslations.has(key);
                  }).length
                }
                /
                {
                  availableLocales.filter((locale) => {
                    const key = `${documentId}:${locale.localeId}`;
                    const status = translationStatuses.get(key);
                    return status?.isReady;
                  }).length
                }
              </Text>
            </Flex>

            <Flex gap={2} align='center' justify='flex-start'>
              <Tooltip
                placement='top'
                content={`Replaces references to ${pluginConfig.getSourceLocale()} documents in this document with the corresponding translated document reference`}
              >
                <Button
                  mode='ghost'
                  tone='caution'
                  onClick={async () => {
                    await handlePatchDocumentReferences();
                  }}
                  text={isBusy ? 'Patching...' : 'Patch References'}
                  icon={isBusy ? null : LinkIcon}
                  disabled={isBusy || isImporting}
                  style={{ minWidth: '180px' }}
                />
              </Tooltip>
              <Flex gap={2} align='center'>
                <Switch
                  checked={autoPatchReferences}
                  onChange={() => setAutoPatchReferences(!autoPatchReferences)}
                  disabled={isImporting || isBusy}
                />
                <Text size={1}>Auto-patch after import</Text>
              </Flex>
            </Flex>

            <Flex gap={2} align='center' justify='flex-start'>
              <Tooltip
                placement='top'
                content='Publishes all translations (if the source document is published)'
              >
                <Button
                  mode='ghost'
                  tone='positive'
                  onClick={async () => {
                    setIsPublishing(true);
                    try {
                      await handlePublishAllTranslations();
                    } finally {
                      setIsPublishing(false);
                    }
                  }}
                  text={isPublishing ? 'Publishing...' : 'Publish Translations'}
                  icon={isPublishing ? null : PublishIcon}
                  disabled={isBusy || isPublishing || isImporting}
                  style={{ minWidth: '180px' }}
                />
              </Tooltip>
              <Flex gap={2} align='center'>
                <Switch
                  checked={autoPublish}
                  onChange={() => setAutoPublish(!autoPublish)}
                  disabled={isPublishing || isImporting || isBusy}
                />
                <Text size={1}>Auto-publish after import</Text>
              </Flex>
            </Flex>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
};
