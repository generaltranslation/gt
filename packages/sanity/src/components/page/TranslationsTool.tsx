import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Stack,
  Switch,
  Text,
  Spinner,
  Tooltip,
} from '@sanity/ui';
import {
  DownloadIcon,
  CheckmarkCircleIcon,
  LinkIcon,
  PublishIcon,
} from '@sanity/icons';
import { Link } from 'sanity/router';
import { BaseTranslationWrapper } from '../shared/BaseTranslationWrapper';
import { TranslationsProvider, useTranslations } from '../TranslationsProvider';
import { TranslationsTable } from './TranslationsTable';
import { TranslateAllDialog } from './TranslateAllDialog';
import { ImportAllDialog } from './ImportAllDialog';
import { ImportMissingDialog } from './ImportMissingDialog';

const TranslationsToolContent: React.FC = () => {
  const [isTranslateAllDialogOpen, setIsTranslateAllDialogOpen] =
    useState(false);
  const [isImportAllDialogOpen, setIsImportAllDialogOpen] = useState(false);
  const [isImportMissingDialogOpen, setIsImportMissingDialogOpen] =
    useState(false);

  const {
    isBusy,
    documents,
    locales,
    autoRefresh,
    loadingDocuments,
    importProgress,
    importedTranslations,
    isRefreshing,
    setAutoRefresh,
    handleRefreshAll,
    handlePatchDocumentReferences,
    handlePublishAllTranslations,
  } = useTranslations();

  return (
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
                disabled={isBusy || loadingDocuments || documents.length === 0}
              />
            </Flex>

            <TranslationsTable />

            <Stack space={3}>
              <Flex gap={3} align='center' justify='space-between'>
                <Flex gap={2} align='center'>
                  <Tooltip
                    placement='top'
                    content='Imports and overrides all translations'
                  >
                    <Button
                      mode='ghost'
                      onClick={() => setIsImportAllDialogOpen(true)}
                      text={isBusy ? 'Importing...' : 'Import All'}
                      icon={isBusy ? null : DownloadIcon}
                      disabled={
                        isBusy || loadingDocuments || documents.length === 0
                      }
                    />
                  </Tooltip>
                  <Tooltip
                    placement='top'
                    content="Imports all translations that are not yet imported (according to the source document's translation.metadata document)"
                  >
                    <Button
                      mode='ghost'
                      tone='primary'
                      onClick={() => setIsImportMissingDialogOpen(true)}
                      text={isBusy ? 'Importing...' : 'Import Missing'}
                      icon={isBusy ? null : DownloadIcon}
                      disabled={
                        isBusy || loadingDocuments || documents.length === 0
                      }
                    />
                  </Tooltip>
                  <Tooltip
                    placement='top'
                    content='Replaces references in documents with the corresponding translated document reference'
                  >
                    <Button
                      mode='ghost'
                      tone='caution'
                      onClick={handlePatchDocumentReferences}
                      text={
                        isBusy ? 'Patching...' : 'Patch Document References'
                      }
                      icon={isBusy ? null : LinkIcon}
                      disabled={
                        isBusy || loadingDocuments || documents.length === 0
                      }
                    />
                  </Tooltip>
                  <Tooltip
                    placement='top'
                    content='Publishes all translations whose source document is published'
                  >
                    <Button
                      mode='ghost'
                      tone='positive'
                      onClick={handlePublishAllTranslations}
                      text={isBusy ? 'Publishing...' : 'Publish Translations'}
                      icon={isBusy ? null : PublishIcon}
                      disabled={
                        isBusy || loadingDocuments || documents.length === 0
                      }
                    />
                  </Tooltip>
                  {importedTranslations.size ===
                    documents.length *
                      locales.filter((l) => l.enabled !== false).length &&
                    documents.length > 0 &&
                    locales.length > 0 && (
                      <Flex gap={2} align='center' style={{ color: 'green' }}>
                        <CheckmarkCircleIcon />
                        <Text size={1}>All translations imported</Text>
                      </Flex>
                    )}
                  {importedTranslations.size > 0 &&
                    importedTranslations.size <
                      documents.length *
                        locales.filter((l) => l.enabled !== false).length && (
                      <Text size={1} style={{ color: '#666' }}>
                        {importedTranslations.size}/
                        {documents.length *
                          locales.filter((l) => l.enabled !== false)
                            .length}{' '}
                        imported
                      </Text>
                    )}
                </Flex>
                <Box />
              </Flex>

              {importProgress.isImporting && (
                <Flex justify='center' align='center' gap={3}>
                  <Spinner size={1} />
                  <Text size={1}>
                    Importing {importProgress.current} of {importProgress.total}{' '}
                    translations...
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

      <TranslateAllDialog
        isOpen={isTranslateAllDialogOpen}
        onClose={() => setIsTranslateAllDialogOpen(false)}
      />
      <ImportAllDialog
        isOpen={isImportAllDialogOpen}
        onClose={() => setIsImportAllDialogOpen(false)}
      />
      <ImportMissingDialog
        isOpen={isImportMissingDialogOpen}
        onClose={() => setIsImportMissingDialogOpen(false)}
      />
    </Container>
  );
};

const TranslationsTool: React.FC = () => {
  return (
    <BaseTranslationWrapper showContainer={false}>
      <TranslationsProvider>
        <TranslationsToolContent />
      </TranslationsProvider>
    </BaseTranslationWrapper>
  );
};

export default TranslationsTool;
