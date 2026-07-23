import React from 'react';
import { Badge, Box, Card, Flex, Spinner, Stack, Text } from '@sanity/ui';
import { Preview, useSchema, type SanityDocument } from 'sanity';
import { useIntentLink } from 'sanity/router';
import { LanguageStatus } from '../shared/LanguageStatus';
import { useTranslations } from '../TranslationsProvider';
import {
  createTranslationStatusKey,
  getDocumentPublishedId,
} from '../../utils/documentIds';

const DocumentRow: React.FC<{ document: SanityDocument }> = ({ document }) => {
  const {
    locales,
    translationStatuses,
    downloadStatus,
    importedTranslations,
    handleImportDocument,
    branchId,
    getVersionId,
  } = useTranslations();

  const schema = useSchema();
  const schemaType = schema.get(document._type);
  const publishedId = getDocumentPublishedId(document);

  const editLink = useIntentLink({
    intent: 'edit',
    params: { id: publishedId, type: document._type },
  });

  const enabledLocales = locales.filter((locale) => locale.enabled !== false);

  return (
    <Card border radius={3} overflow='hidden'>
      <Card
        as='a'
        href={editLink.href}
        onClick={editLink.onClick}
        padding={2}
        radius={0}
        borderBottom
        style={{ textDecoration: 'none', color: 'inherit' }}
        title='Open document'
      >
        <Flex align='center' gap={3}>
          <Box flex={1}>
            {schemaType ? (
              <Preview value={document} schemaType={schemaType} />
            ) : (
              <Text weight='semibold' size={1}>
                {publishedId}
              </Text>
            )}
          </Box>
          <Badge fontSize={0} radius={2}>
            {schemaType?.title ?? document._type}
          </Badge>
        </Flex>
      </Card>

      <Box paddingY={1}>
        {enabledLocales.length > 0 ? (
          <Stack space={1}>
            {enabledLocales.map((locale) => {
              const versionId = getVersionId(document);
              const key = createTranslationStatusKey(
                branchId,
                publishedId,
                versionId,
                locale.localeId
              );
              const status = translationStatuses.get(key);
              const isDownloaded = downloadStatus.downloaded.has(key);
              const isImported = importedTranslations.has(key);

              return (
                <LanguageStatus
                  key={`${document._id}-${versionId}-${locale.localeId}`}
                  localeId={locale.localeId}
                  progress={status?.progress || 0}
                  isImported={isImported || isDownloaded}
                  importFile={async () => {
                    await handleImportDocument(
                      publishedId,
                      versionId,
                      locale.localeId
                    );
                  }}
                />
              );
            })}
          </Stack>
        ) : (
          <Box padding={3}>
            <Text size={1} muted>
              No locales configured
            </Text>
          </Box>
        )}
      </Box>
    </Card>
  );
};

export const TranslationsTable: React.FC = () => {
  const { documents, loadingDocuments } = useTranslations();

  if (loadingDocuments) {
    return (
      <Flex align='center' justify='center' padding={4}>
        <Spinner />
      </Flex>
    );
  }

  return (
    <Box style={{ maxHeight: '60vh', overflowY: 'auto' }}>
      <Stack space={2}>
        {documents.map((document) => (
          <DocumentRow key={document._id} document={document} />
        ))}
      </Stack>
    </Box>
  );
};
