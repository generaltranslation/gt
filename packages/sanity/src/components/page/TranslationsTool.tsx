import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Spinner,
  Stack,
  Switch,
  Text,
  ThemeProvider,
  ToastProvider,
  Card,
} from '@sanity/ui';
import { DownloadIcon, CheckmarkCircleIcon, LinkIcon, PublishIcon } from '@sanity/icons';
import { buildTheme } from '@sanity/ui/theme';
import { Link } from 'sanity/router';
import { TranslationsProvider, useTranslations } from './TranslationsProvider';
import { TranslationsTable } from './TranslationsTable';
import { TranslateAllDialog } from './TranslateAllDialog';
import { ImportAllDialog } from './ImportAllDialog';
import { ImportMissingDialog } from './ImportMissingDialog';

const theme = buildTheme();

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
    loadingSecrets,
    secrets,
    setAutoRefresh,
    handleRefreshAll,
    handlePatchDocumentReferences,
    handlePublishAllTranslations,
  } = useTranslations();

  if (loadingSecrets) {
    return (
      <Container width={2}>
        <Flex padding={5} align='center' justify='center'>
          <Spinner />
        </Flex>
      </Container>
    );
  }

  if (!secrets) {
    return (
      <Container width={2}>
        <Box padding={4} marginTop={5}>
          <Card tone='caution' padding={[2, 3, 4, 4]} shadow={1} radius={2}>
            <Text>
              Can't find secrets for your translation service. Did you load them
              into this dataset?
            </Text>
          </Card>
        </Box>
      </Container>
    );
  }

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
                  <Button
                    mode='ghost'
                    onClick={() => setIsImportAllDialogOpen(true)}
                    text={isBusy ? 'Importing...' : 'Import All'}
                    icon={isBusy ? null : DownloadIcon}
                    disabled={
                      isBusy || loadingDocuments || documents.length === 0
                    }
                  />
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
                  <Button
                    mode='ghost'
                    tone='caution'
                    onClick={handlePatchDocumentReferences}
                    text={isBusy ? 'Patching...' : 'Patch Document References'}
                    icon={isBusy ? null : LinkIcon}
                    disabled={
                      isBusy || loadingDocuments || documents.length === 0
                    }
                  />
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
    <ThemeProvider theme={theme}>
      <ToastProvider paddingY={7}>
        <TranslationsProvider>
          <TranslationsToolContent />
        </TranslationsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default TranslationsTool;
