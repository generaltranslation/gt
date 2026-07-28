import React, { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@sanity/ui';
import {
  CheckmarkCircleIcon,
  DownloadIcon,
  LinkIcon,
  PublishIcon,
  RefreshIcon,
  TranslateIcon,
} from '@sanity/icons';
import { Link } from 'sanity/router';
import { BaseTranslationWrapper } from '../shared/BaseTranslationWrapper';
import { TranslationsProvider, useTranslations } from '../TranslationsProvider';
import { TranslationsTable } from './TranslationsTable';
import { TranslateAllDialog } from './TranslateAllDialog';
import { ImportAllDialog } from './ImportAllDialog';
import { ImportMissingDialog } from './ImportMissingDialog';
import { BatchProgress } from './BatchProgress';

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

  // Track which specific operation is running
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);

  const getProgressOperationName = () => {
    switch (currentOperation) {
      case 'Import All':
        return 'Importing';
      case 'Import Missing':
        return 'Importing missing';
      case 'Patch References':
        return 'Patching';
      case 'Publish Translations':
        return 'Publishing';
      default:
        return 'Processing';
    }
  };

  // Reset current operation when operation completes
  React.useEffect(() => {
    if (!isBusy && !importProgress.isImporting) {
      setCurrentOperation(null);
    }
  }, [isBusy, importProgress.isImporting]);

  const enabledLocaleCount = locales.filter((l) => l.enabled !== false).length;
  const totalTranslations = documents.length * enabledLocaleCount;
  const actionsDisabled = isBusy || loadingDocuments || documents.length === 0;

  return (
    <Container width={2}>
      <Box padding={4} marginTop={5}>
        <Stack space={5}>
          <Flex align='flex-start' justify='space-between' gap={4}>
            <Stack space={3}>
              <Heading as='h2' size={3}>
                Translations
              </Heading>
              <Text size={1} muted>
                Manage your document translations from this centralized
                location.
              </Text>
            </Stack>

            <Button
              icon={TranslateIcon}
              text='Translate All'
              loading={isBusy && currentOperation === 'Translate All'}
              onClick={() => {
                setCurrentOperation('Translate All');
                setIsTranslateAllDialogOpen(true);
              }}
              disabled={actionsDisabled}
            />
          </Flex>

          <Stack space={3}>
            <Flex align='center' justify='space-between' gap={3}>
              <Text size={1} muted>
                {loadingDocuments
                  ? 'Loading documents...'
                  : `${documents.length} ${
                      documents.length === 1 ? 'document' : 'documents'
                    } available for translation`}
              </Text>

              <Flex gap={3} align='center'>
                <Flex gap={2} align='center'>
                  <Text size={1} muted>
                    Auto-refresh
                  </Text>
                  <Switch
                    checked={autoRefresh}
                    onChange={() => setAutoRefresh(!autoRefresh)}
                  />
                </Flex>
                <Button
                  fontSize={1}
                  padding={2}
                  mode='ghost'
                  icon={RefreshIcon}
                  text='Refresh'
                  loading={isRefreshing}
                  onClick={handleRefreshAll}
                  disabled={isRefreshing || actionsDisabled}
                />
              </Flex>
            </Flex>

            <TranslationsTable />
          </Stack>

          <Stack space={3}>
            <Flex gap={2} align='center' justify='space-between'>
              <Flex gap={2} align='center' wrap='wrap'>
                <Tooltip
                  placement='top'
                  content='Imports and overrides all translations'
                >
                  <Button
                    mode='ghost'
                    fontSize={1}
                    onClick={() => {
                      setCurrentOperation('Import All');
                      setIsImportAllDialogOpen(true);
                    }}
                    text='Import All'
                    loading={isBusy && currentOperation === 'Import All'}
                    icon={DownloadIcon}
                    disabled={actionsDisabled}
                  />
                </Tooltip>
                <Tooltip
                  placement='top'
                  content="Imports all translations that are not yet imported (according to the source document's translation.metadata document)"
                >
                  <Button
                    mode='ghost'
                    fontSize={1}
                    onClick={() => {
                      setCurrentOperation('Import Missing');
                      setIsImportMissingDialogOpen(true);
                    }}
                    text='Import Missing'
                    loading={isBusy && currentOperation === 'Import Missing'}
                    icon={DownloadIcon}
                    disabled={actionsDisabled}
                  />
                </Tooltip>
                <Tooltip
                  placement='top'
                  content='Replaces references in documents with the corresponding translated document reference'
                >
                  <Button
                    mode='ghost'
                    fontSize={1}
                    onClick={() => {
                      setCurrentOperation('Patch References');
                      handlePatchDocumentReferences();
                    }}
                    text='Patch References'
                    loading={isBusy && currentOperation === 'Patch References'}
                    icon={LinkIcon}
                    disabled={actionsDisabled}
                  />
                </Tooltip>
                <Tooltip
                  placement='top'
                  content='Publishes all translations whose source document is published'
                >
                  <Button
                    mode='ghost'
                    fontSize={1}
                    onClick={() => {
                      setCurrentOperation('Publish Translations');
                      handlePublishAllTranslations();
                    }}
                    text='Publish Translations'
                    loading={
                      isBusy && currentOperation === 'Publish Translations'
                    }
                    icon={PublishIcon}
                    disabled={actionsDisabled}
                  />
                </Tooltip>
              </Flex>

              {totalTranslations > 0 &&
                importedTranslations.size === totalTranslations && (
                  <Badge tone='positive' fontSize={0} radius={2}>
                    <Flex align='center' gap={1}>
                      <CheckmarkCircleIcon />
                      <Box>All translations imported</Box>
                    </Flex>
                  </Badge>
                )}
              {importedTranslations.size > 0 &&
                importedTranslations.size < totalTranslations && (
                  <Text size={1} muted>
                    {importedTranslations.size}/{totalTranslations} imported
                  </Text>
                )}
            </Flex>

            <BatchProgress
              isActive={importProgress.isImporting}
              current={importProgress.current}
              total={importProgress.total}
              operationName={getProgressOperationName()}
            />
          </Stack>

          <Card borderTop paddingTop={4}>
            <Text size={1} muted>
              For more information, see the{' '}
              <Link href='https://dash.generaltranslation.com'>
                General Translation Dashboard
              </Link>
              .
            </Text>
          </Card>
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
