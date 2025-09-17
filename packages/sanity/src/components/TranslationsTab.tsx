import { useMemo } from 'react';
import { SanityDocument, useSchema } from 'sanity';
import { randomKey } from '@sanity/util/content';
import {
  ThemeProvider,
  ToastProvider,
  Stack,
  Text,
  Layer,
  Box,
  Card,
  Flex,
  Spinner,
} from '@sanity/ui';

import { TranslationContext } from './TranslationContext';
import { TranslationView } from './TranslationView';
import { useClient } from '../hooks/useClient';
import { useSecrets } from '../hooks/useSecrets';
import { Secrets, TranslationsTabConfigOptions } from '../types';

type TranslationTabProps = {
  document: {
    displayed: SanityDocument;
  };
  options: TranslationsTabConfigOptions;
};

const TranslationTab = (props: TranslationTabProps) => {
  const { displayed } = props.document;
  const client = useClient();
  const schema = useSchema();

  const documentId =
    displayed && displayed._id
      ? (displayed._id.split('drafts.').pop() as string)
      : '';

  const { errors, importTranslation, exportForTranslation } = useMemo(() => {
    const {
      serializationOptions,
      baseLanguage,
      languageField,
      mergeWithTargetLocale,
    } = props.options;
    const ctx = {
      client,
      schema,
    };

    const allErrors = [];

    const importTranslationFunc = props.options.importTranslation;
    if (!importTranslationFunc) {
      allErrors.push({
        key: randomKey(12),
        text: (
          <>
            You need to provide an <code>importTranslation</code> function. See
            documentation.
          </>
        ),
      });
    }

    const contextImportTranslation = (localeId: string, doc: string) => {
      return importTranslationFunc(
        documentId,
        localeId,
        doc,
        ctx,
        baseLanguage,
        serializationOptions,
        languageField,
        mergeWithTargetLocale
      );
    };

    const exportTranslationFunc = props.options.exportForTranslation;
    if (!exportTranslationFunc) {
      allErrors.push({
        key: randomKey(12),
        text: (
          <>
            You need to provide an <code>exportForTranslation</code> function.
            See documentation.
          </>
        ),
      });
    }

    const contextExportForTranslation = (id: string) => {
      return exportTranslationFunc(
        id,
        ctx,
        baseLanguage,
        serializationOptions,
        languageField
      );
    };

    return {
      errors: allErrors,
      importTranslation: contextImportTranslation,
      exportForTranslation: contextExportForTranslation,
    };
  }, [props.options, documentId, client, schema]);

  const { loading, secrets } = useSecrets<Secrets>(
    `${props.options.secretsNamespace || 'translationService'}.secrets`
  );

  const hasErrors = errors.length > 0;

  if (loading || !secrets) {
    return (
      <ThemeProvider>
        <Flex padding={5} align='center' justify='center'>
          <Spinner />
        </Flex>
      </ThemeProvider>
    );
  } else if (!secrets) {
    return (
      <ThemeProvider>
        <Box padding={4}>
          <Card tone='caution' padding={[2, 3, 4, 4]} shadow={1} radius={2}>
            <Text>
              Can't find secrets for your translation service. Did you load them
              into this dataset?
            </Text>
          </Card>
        </Box>
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider>
      <Box padding={4}>
        <Layer>
          <ToastProvider paddingY={7}>
            {hasErrors && (
              <Stack space={3}>
                {errors.map((error) => (
                  <Card
                    key={error.key}
                    tone='caution'
                    padding={[2, 3, 4, 4]}
                    shadow={1}
                    radius={2}
                  >
                    <Text>{error.text}</Text>
                  </Card>
                ))}
              </Stack>
            )}
            {!hasErrors && (
              <TranslationContext.Provider
                value={{
                  documentId,
                  secrets,
                  importTranslation,
                  exportForTranslation,
                  adapter: props.options.adapter,
                  baseLanguage: props.options.baseLanguage,
                  workflowOptions: props.options.workflowOptions,
                  localeIdAdapter: props.options.localeIdAdapter,
                  callbackUrl: props.options.callbackUrl,
                  mergeWithTargetLocale: props.options.mergeWithTargetLocale,
                }}
              >
                <TranslationView />
              </TranslationContext.Provider>
            )}
          </ToastProvider>
        </Layer>
      </Box>
    </ThemeProvider>
  );
};

export default TranslationTab;
