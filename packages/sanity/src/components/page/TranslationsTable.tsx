import React from 'react';
import { Box, Card, Stack, Text, Flex, Spinner } from '@sanity/ui';
import { LanguageStatus } from '../LanguageStatus';
import { useTranslations } from './TranslationsProvider';

export const TranslationsTable: React.FC = () => {
  const {
    documents,
    locales,
    loadingDocuments,
    translationStatuses,
    downloadStatus,
    importedTranslations,
    handleImportDocument,
  } = useTranslations();

  if (loadingDocuments) {
    return (
      <Flex align="center" justify="center" padding={4}>
        <Spinner />
      </Flex>
    );
  }

  return (
    <Box style={{ maxHeight: '60vh', overflowY: 'auto' }}>
      <Stack space={2}>
        {documents.map((document) => (
          <Card key={document._id} shadow={1} padding={3}>
            <Stack space={3}>
              <Flex justify="space-between" align="flex-start">
                <Box flex={1}>
                  <Text weight="semibold" size={1}>
                    {document._id?.replace('drafts.', '') || document._id}
                  </Text>
                  <Text size={0} muted style={{ marginTop: '2px' }}>
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
                        document._id?.replace('drafts.', '') || document._id;
                      const key = `${documentId}:${locale.localeId}`;
                      const status = translationStatuses.get(key);
                      const isDownloaded = downloadStatus.downloaded.has(key);
                      const isImported = importedTranslations.has(key);

                      return (
                        <LanguageStatus
                          key={`${document._id}-${locale.localeId}`}
                          title={locale.description || locale.localeId}
                          progress={status?.progress || 0}
                          isImported={isImported || isDownloaded}
                          importFile={async () => {
                            await handleImportDocument(documentId, locale.localeId);
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
  );
};