import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  Container,
  Dialog,
  Flex,
  Heading,
  Spinner,
  Stack,
  Switch,
  Text,
  ThemeProvider,
  ToastProvider,
  useToast,
} from '@sanity/ui';
import { DownloadIcon, CheckmarkCircleIcon } from '@sanity/icons';
import { buildTheme } from '@sanity/ui/theme';
import { Link } from 'sanity/router';
import { SanityDocument, useSchema } from 'sanity';
import { useClient } from '../../hooks/useClient';
import { useSecrets } from '../../hooks/useSecrets';
import { GTAdapter } from '../../adapter';
import {
  GTFile,
  Secrets,
  TranslationLocale,
  TranslationFunctionContext,
} from '../../types';
import { gtConfig } from '../../adapter/core';
import { LanguageStatus } from '../LanguageStatus';
import { serializeDocument } from '../../utils/serialize';
import { uploadFiles } from '../../translation/uploadFiles';
import { initProject } from '../../translation/initProject';
import { createJobs } from '../../translation/createJobs';
import {
  downloadTranslations,
  BatchedFiles,
} from '../../translation/downloadTranslations';
import { checkTranslationStatus } from '../../translation/checkTranslationStatus';
import { importDocument } from '../../translation/importDocument';

const theme = buildTheme();

const TranslationsTool = () => {
  const [isTranslateAllDialogOpen, setIsTranslateAllDialogOpen] =
    useState(false);
  const [isImportAllDialogOpen, setIsImportAllDialogOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [documents, setDocuments] = useState<SanityDocument[]>([]);
  const [locales, setLocales] = useState<TranslationLocale[]>([]);
  const [autoPublish, setAutoPublish] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    isImporting: false,
  });
  const [importedTranslations, setImportedTranslations] = useState<Set<string>>(
    new Set()
  );
  const [downloadStatus, setDownloadStatus] = useState({
    downloaded: new Set<string>(),
    failed: new Set<string>(),
    skipped: new Set<string>(),
  });
  const [translationStatuses, setTranslationStatuses] = useState<
    Map<string, { progress: number; isReady: boolean; translationId?: string }>
  >(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const client = useClient();
  const schema = useSchema();
  const translationContext: TranslationFunctionContext = { client, schema };
  const toast = useToast();
  const { loading: loadingSecrets, secrets } = useSecrets<Secrets>(
    `${gtConfig.getSecretsNamespace()}.secrets`
  );

  const fetchDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    try {
      const translateDocuments = gtConfig.getTranslateDocuments();

      // Build filter conditions based on translateDocuments configuration
      const filterConditions = translateDocuments
        .map((filter) => {
          if (filter.type && filter.documentId) {
            // Both type and documentId must match
            return `(_type == "${filter.type}" && _id == "${filter.documentId}")`;
          } else if (filter.type) {
            // Only type must match
            return `_type == "${filter.type}"`;
          } else if (filter.documentId) {
            // Only documentId must match
            return `_id == "${filter.documentId}"`;
          }
          return null;
        })
        .filter(Boolean);

      // If no filters are configured, fall back to the original query
      const languageField = gtConfig.getLanguageField();
      const sourceLocale = gtConfig.getSourceLocale();
      const languageFilter = `(!defined(${languageField}) || ${languageField} == "${sourceLocale}")`;

      let query;
      if (filterConditions.length === 0) {
        query = `*[!(_type in ["system.group"]) && !(_id in path("_.**")) && ${languageFilter}]`;
      } else {
        const filterQuery = filterConditions.join(' || ');
        query = `*[!(_type in ["system.group"]) && !(_id in path("_.**")) && (${filterQuery}) && ${languageFilter}]`;
      }

      const docs = await client.fetch(query);
      setDocuments(docs);
    } catch {
      toast.push({
        title: 'Error fetching documents',
        status: 'error',
        closable: true,
      });
    } finally {
      setLoadingDocuments(false);
    }
  }, [client, toast]);

  const fetchLocales = useCallback(async () => {
    if (!secrets) return;
    try {
      const availableLocales = await GTAdapter.getLocales(secrets);
      setLocales(availableLocales);
    } catch {
      toast.push({
        title: 'Error fetching locales',
        status: 'error',
        closable: true,
      });
    }
  }, [secrets, toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (secrets) {
      fetchLocales();
    }
  }, [fetchLocales, secrets]);

  const handleTranslateAll = useCallback(async () => {
    if (!secrets || documents.length === 0) return;

    setIsBusy(true);
    setIsTranslateAllDialogOpen(false);

    try {
      const availableLocaleIds = locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId);

      console.log('documents', documents);
      // Transform documents to the required format
      const transformedDocuments = documents
        .map((doc) => {
          delete doc[gtConfig.getLanguageField()];
          const baseLanguage = gtConfig.getSourceLocale();
          try {
            const serialized = serializeDocument(doc, schema, baseLanguage);
            return {
              info: {
                documentId: doc._id?.replace('drafts.', '') || doc._id,
                versionId: doc._rev,
              },
              serializedDocument: serialized,
            };
          } catch (error) {
            console.error('Error transforming document', doc._id, error);
          }
          return null;
        })
        .filter((doc) => doc !== null);

      console.log('transformedDocuments', transformedDocuments);
      console.log('transformedDocuments.length', transformedDocuments.length);
      const uploadResult = await uploadFiles(transformedDocuments, secrets);
      await initProject(uploadResult, { timeout: 600 }, secrets);
      await createJobs(uploadResult, availableLocaleIds, secrets);

      toast.push({
        title: `Translation tasks created for ${documents.length} documents`,
        status: 'success',
        closable: true,
      });
    } catch {
      toast.push({
        title: 'Error creating translation tasks',
        status: 'error',
        closable: true,
      });
    } finally {
      setIsBusy(false);
    }
  }, [secrets, documents, locales, toast]);

  const handleImportAll = useCallback(async () => {
    if (!secrets || documents.length === 0) return;

    setIsBusy(true);
    setIsImportAllDialogOpen(false);

    try {
      // Collect all ready translations
      const readyFiles: BatchedFiles = [];

      for (const [key, status] of translationStatuses.entries()) {
        if (status.isReady && status.translationId) {
          const [documentId, locale] = key.split(':');
          const document = documents.find(
            (doc) => (doc._id?.replace('drafts.', '') || doc._id) === documentId
          );

          if (document) {
            readyFiles.push({
              documentId,
              versionId: document._rev,
              translationId: status.translationId,
              locale,
            });
          }
        }
      }

      if (readyFiles.length === 0) {
        toast.push({
          title: 'No ready translations to import',
          status: 'warning',
          closable: true,
        });
        return;
      }

      // Download all ready translations
      const downloadedFiles = await downloadTranslations(readyFiles, secrets);

      // Set up progress tracking
      setImportProgress({
        current: 0,
        total: downloadedFiles.length,
        isImporting: true,
      });

      // Batch import in groups of 10
      const batchSize = 10;
      let successCount = 0;
      let failureCount = 0;
      const successfulImports: string[] = [];

      for (let i = 0; i < downloadedFiles.length; i += batchSize) {
        const batch = downloadedFiles.slice(i, i + batchSize);

        // Process batch in parallel
        const batchPromises = batch.map(async (file) => {
          try {
            const docInfo: GTFile = {
              documentId: file.docData.documentId,
              versionId: file.docData.versionId,
            };

            await importDocument(
              docInfo,
              file.docData.locale,
              file.data,
              translationContext,
              autoPublish
            );

            const key = `${file.docData.documentId}:${file.docData.locale}`;
            successfulImports.push(key);
            setImportedTranslations((prev) => new Set([...prev, key]));
            return { success: true, file };
          } catch (error) {
            console.error(
              `Failed to import ${file.docData.documentId} (${file.docData.locale}):`,
              error
            );
            return { success: false, file, error };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach((result) => {
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
        });

        // Update progress
        setImportProgress({
          current: i + batch.length,
          total: downloadedFiles.length,
          isImporting: true,
        });
      }

      // Update download status for successful imports
      if (successfulImports.length > 0) {
        const newDownloadStatus = {
          ...downloadStatus,
          downloaded: new Set([
            ...downloadStatus.downloaded,
            ...successfulImports,
          ]),
        };
        setDownloadStatus(newDownloadStatus);
      }

      toast.push({
        title: `Imported ${successCount} translations${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        status: successCount > 0 ? 'success' : 'error',
        closable: true,
      });
    } catch (error) {
      console.error('Error importing translations:', error);
      toast.push({
        title: 'Error importing translations',
        status: 'error',
        closable: true,
      });
    } finally {
      setIsBusy(false);
      setImportProgress({ current: 0, total: 0, isImporting: false });
    }
  }, [
    secrets,
    documents,
    translationStatuses,
    downloadStatus,
    toast,
    autoPublish,
    translationContext,
  ]);

  const handleRefreshAll = useCallback(async () => {
    if (!secrets || documents.length === 0) return;

    setIsRefreshing(true);

    try {
      const availableLocaleIds = locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId);

      // Create file query data for all document/locale combinations
      const fileQueryData = [];
      for (const doc of documents) {
        for (const localeId of availableLocaleIds) {
          const documentId = doc._id?.replace('drafts.', '') || doc._id;
          fileQueryData.push({
            versionId: doc._rev,
            fileId: documentId,
            locale: localeId,
          });
        }
      }
      // Check translation status for all files
      const readyTranslations = await checkTranslationStatus(
        fileQueryData,
        downloadStatus,
        secrets
      );

      // Update translation statuses
      const newStatuses = new Map(translationStatuses);

      // Reset all to not ready first
      for (const doc of documents) {
        for (const localeId of availableLocaleIds) {
          const documentId = doc._id?.replace('drafts.', '') || doc._id;
          const key = `${documentId}:${localeId}`;
          newStatuses.set(key, { progress: 0, isReady: false });
        }
      }

      // Update with ready translations
      if (Array.isArray(readyTranslations)) {
        for (const translation of readyTranslations) {
          const key = `${translation.fileId}:${translation.locale}`;
          newStatuses.set(key, {
            progress: 100,
            isReady: true,
            translationId: translation.id,
          });
        }
      }

      setTranslationStatuses(newStatuses);

      toast.push({
        title: `Refreshed status for ${documents.length} documents`,
        status: 'success',
        closable: true,
      });
    } catch (error) {
      console.error('Error refreshing translation status:', error);
      toast.push({
        title: 'Error refreshing translation status',
        status: 'error',
        closable: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [secrets, documents, locales, downloadStatus, translationStatuses, toast]);

  // Auto-refresh on page load after documents and locales are loaded
  useEffect(() => {
    if (
      documents.length > 0 &&
      locales.length > 0 &&
      secrets &&
      !loadingDocuments
    ) {
      handleRefreshAll();
    }
  }, [documents]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || documents.length === 0 || !secrets) return;

    const interval = setInterval(async () => {
      await handleRefreshAll();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, documents.length, secrets, handleRefreshAll]);

  // Initialize imported translations from download status
  useEffect(() => {
    setImportedTranslations(new Set(downloadStatus.downloaded));
  }, [downloadStatus.downloaded]);

  const handleImportDocument = useCallback(
    async (documentId: string, localeId: string) => {
      if (!secrets) return;

      try {
        const key = `${documentId}:${localeId}`;
        const status = translationStatuses.get(key);

        if (!status?.isReady || !status.translationId) {
          toast.push({
            title: `Translation not ready for ${documentId} (${localeId})`,
            status: 'warning',
            closable: true,
          });
          return;
        }

        const document = documents.find(
          (doc) => (doc._id?.replace('drafts.', '') || doc._id) === documentId
        );

        if (!document) {
          toast.push({
            title: `Document ${documentId} not found`,
            status: 'error',
            closable: true,
          });
          return;
        }

        // Download single translation
        const downloadedFiles = await downloadTranslations(
          [
            {
              documentId,
              versionId: document._rev,
              translationId: status.translationId,
              locale: localeId,
            },
          ],
          secrets
        );

        if (downloadedFiles.length > 0) {
          try {
            const docInfo: GTFile = {
              documentId,
              versionId: document._rev,
            };

            await importDocument(
              docInfo,
              localeId,
              downloadedFiles[0].data,
              translationContext,
              autoPublish
            );

            // Update download status and imported translations
            const newDownloadStatus = {
              ...downloadStatus,
              downloaded: new Set([...downloadStatus.downloaded, key]),
            };
            setDownloadStatus(newDownloadStatus);
            setImportedTranslations((prev) => new Set([...prev, key]));

            toast.push({
              title: `Successfully imported translation for ${documentId} (${localeId})`,
              status: 'success',
              closable: true,
            });
          } catch (importError) {
            console.error('Failed to import translation:', importError);
            toast.push({
              title: `Failed to import translation for ${documentId} (${localeId})`,
              status: 'error',
              closable: true,
            });
          }
        } else {
          toast.push({
            title: `No translation content received for ${documentId}`,
            status: 'warning',
            closable: true,
          });
        }
      } catch (error) {
        console.error('Error importing translation:', error);
        toast.push({
          title: `Error importing translation for ${documentId}`,
          status: 'error',
          closable: true,
        });
      }
    },
    [
      secrets,
      translationStatuses,
      documents,
      downloadStatus,
      toast,
      autoPublish,
      translationContext,
    ]
  );

  if (loadingSecrets) {
    return (
      <ThemeProvider theme={theme}>
        <Container width={2}>
          <Flex padding={5} align='center' justify='center'>
            <Spinner />
          </Flex>
        </Container>
      </ThemeProvider>
    );
  }

  if (!secrets) {
    return (
      <ThemeProvider theme={theme}>
        <Container width={2}>
          <Box padding={4} marginTop={5}>
            <Card tone='caution' padding={[2, 3, 4, 4]} shadow={1} radius={2}>
              <Text>
                Can't find secrets for your translation service. Did you load
                them into this dataset?
              </Text>
            </Card>
          </Box>
        </Container>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <ToastProvider paddingY={7}>
        <Container width={2}>
          <Box padding={4} marginTop={5}>
            <Stack space={4}>
              <Flex align='center' justify='space-between'>
                <Stack space={2}>
                  <Heading as='h2' size={3}>
                    Translations
                  </Heading>
                  <Text size={2}>
                    Manage your document translations from this centralized
                    location.
                  </Text>
                </Stack>

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
                    text={isRefreshing ? 'Refreshing...' : 'Refresh Status'}
                    onClick={handleRefreshAll}
                    disabled={
                      isRefreshing ||
                      isBusy ||
                      loadingDocuments ||
                      documents.length === 0
                    }
                  />
                </Flex>
              </Flex>

              <Stack space={4}>
                <Box>
                  <Text size={1} muted>
                    {loadingDocuments
                      ? 'Loading documents...'
                      : `Found ${documents.length} documents available for translation`}
                  </Text>
                </Box>

                <Flex justify='center'>
                  <Button
                    style={{ width: '200px' }}
                    tone='critical'
                    text={isBusy ? 'Processing...' : 'Translate All'}
                    onClick={() => setIsTranslateAllDialogOpen(true)}
                    disabled={
                      isBusy || loadingDocuments || documents.length === 0
                    }
                  />
                </Flex>

                {loadingDocuments ? (
                  <Flex align='center' justify='center' padding={4}>
                    <Spinner />
                  </Flex>
                ) : (
                  <Box style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <Stack space={2}>
                      {documents.map((document) => (
                        <Card key={document._id} shadow={1} padding={3}>
                          <Stack space={3}>
                            <Flex justify='space-between' align='flex-start'>
                              <Box flex={1}>
                                <Text weight='semibold' size={1}>
                                  {document._id?.replace('drafts.', '') ||
                                    document._id}
                                </Text>
                                <Text
                                  size={0}
                                  muted
                                  style={{ marginTop: '2px' }}
                                >
                                  {document._type}
                                </Text>
                              </Box>
                            </Flex>

                            <Stack space={2}>
                              {locales.length > 0 ? (
                                locales
                                  .filter((locale) => locale.enabled !== false)
                                  .map((locale) => {
                                    const documentId =
                                      document._id?.replace('drafts.', '') ||
                                      document._id;
                                    const key = `${documentId}:${locale.localeId}`;
                                    const status = translationStatuses.get(key);
                                    const isDownloaded =
                                      downloadStatus.downloaded.has(key);
                                    const isImported =
                                      importedTranslations.has(key);

                                    return (
                                      <LanguageStatus
                                        key={`${document._id}-${locale.localeId}`}
                                        title={
                                          locale.description || locale.localeId
                                        }
                                        progress={status?.progress || 0}
                                        isImported={isImported || isDownloaded}
                                        importFile={async () => {
                                          await handleImportDocument(
                                            documentId,
                                            locale.localeId
                                          );
                                        }}
                                      />
                                    );
                                  })
                              ) : (
                                <Text size={1} muted>
                                  No locales configured
                                </Text>
                              )}
                            </Stack>
                          </Stack>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                )}

                <Stack space={3}>
                  <Flex gap={3} align='center' justify='space-between'>
                    <Flex gap={2} align='center'>
                      <Button
                        mode='ghost'
                        onClick={() => setIsImportAllDialogOpen(true)}
                        text={isBusy ? 'Importing...' : 'Import All'}
                        icon={isBusy ? null : DownloadIcon}
                        disabled={
                          isBusy || loadingDocuments || documents.length === 0
                        }
                      />
                      {importedTranslations.size ===
                        documents.length *
                          locales.filter((l) => l.enabled !== false).length &&
                        documents.length > 0 &&
                        locales.length > 0 && (
                          <Flex
                            gap={2}
                            align='center'
                            style={{ color: 'green' }}
                          >
                            <CheckmarkCircleIcon />
                            <Text size={1}>All translations imported</Text>
                          </Flex>
                        )}
                      {importedTranslations.size > 0 &&
                        importedTranslations.size <
                          documents.length *
                            locales.filter((l) => l.enabled !== false)
                              .length && (
                          <Text size={1} style={{ color: '#666' }}>
                            {importedTranslations.size}/
                            {documents.length *
                              locales.filter((l) => l.enabled !== false)
                                .length}{' '}
                            imported
                          </Text>
                        )}
                    </Flex>
                    <Flex
                      gap={2}
                      align='center'
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <Text size={1}>Auto-Publish</Text>
                      <Switch
                        checked={autoPublish}
                        onChange={() => setAutoPublish(!autoPublish)}
                        disabled={isBusy}
                      />
                    </Flex>
                  </Flex>

                  {/* Import Progress UI */}
                  {importProgress.isImporting && (
                    <Flex justify='center' align='center' gap={3}>
                      <Spinner size={1} />
                      <Text size={1}>
                        Importing {importProgress.current} of{' '}
                        {importProgress.total} translations...
                      </Text>
                    </Flex>
                  )}
                </Stack>
              </Stack>

              <Text size={2}>
                For more information, see the{' '}
                <Link href='https://dash.generaltranslation.com'>
                  General Translation Dashboard
                </Link>
                .
              </Text>
            </Stack>
          </Box>

          {/* Translate All Confirmation Dialog */}
          {isTranslateAllDialogOpen && (
            <Dialog
              header='Confirm Translation'
              id='translate-all-dialog'
              onClose={() => setIsTranslateAllDialogOpen(false)}
              footer={
                <Box padding={3}>
                  <Flex gap={2}>
                    <Button
                      text='Cancel'
                      mode='ghost'
                      onClick={() => setIsTranslateAllDialogOpen(false)}
                    />
                    <Button
                      text='Translate All'
                      tone='critical'
                      onClick={handleTranslateAll}
                    />
                  </Flex>
                </Box>
              }
            >
              <Box padding={4}>
                <Stack space={3}>
                  <Text>
                    Are you sure you want to create translation tasks for all{' '}
                    {documents.length} documents?
                  </Text>
                  <Text size={1} muted>
                    This will submit all documents to General Translation for
                    processing.
                  </Text>
                </Stack>
              </Box>
            </Dialog>
          )}

          {/* Import All Confirmation Dialog */}
          {isImportAllDialogOpen && (
            <Dialog
              header='Confirm Import'
              id='import-all-dialog'
              onClose={() => setIsImportAllDialogOpen(false)}
              footer={
                <Box padding={3}>
                  <Flex gap={2}>
                    <Button
                      text='Cancel'
                      mode='ghost'
                      onClick={() => setIsImportAllDialogOpen(false)}
                    />
                    <Button
                      text='Import All'
                      tone='primary'
                      onClick={handleImportAll}
                    />
                  </Flex>
                </Box>
              }
            >
              <Box padding={4}>
                <Stack space={3}>
                  <Text>
                    Are you sure you want to import translations for all{' '}
                    {documents.length} documents?
                  </Text>
                  <Text size={1} muted>
                    This will download and apply translated content to your
                    documents. Note that this will overwrite any existing
                    translations!
                  </Text>
                </Stack>
              </Box>
            </Dialog>
          )}
        </Container>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default TranslationsTool;
