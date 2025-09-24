import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { SanityDocument, useSchema } from 'sanity';
import { useToast } from '@sanity/ui';
import { useClient } from '../hooks/useClient';
import { useSecrets } from '../hooks/useSecrets';
import { GTAdapter } from '../adapter';
import {
  GTFile,
  Secrets,
  TranslationLocale,
  TranslationFunctionContext,
  TranslationTask,
} from '../types';
import { pluginConfig } from '../adapter/core';
import { serializeDocument } from '../utils/serialize';
import { uploadFiles } from '../translation/uploadFiles';
import { initProject } from '../translation/initProject';
import { createJobs } from '../translation/createJobs';
import { downloadTranslations } from '../translation/downloadTranslations';
import { checkTranslationStatus } from '../translation/checkTranslationStatus';
import { importDocument } from '../translation/importDocument';
import { resolveRefs } from '../sanity-api/resolveRefs';
import { findTranslatedDocumentForLocale } from '../sanity-api/findDocuments';
import {
  getReadyFilesForImport,
  importTranslations,
  ImportOptions,
} from '../utils/importUtils';
import { processBatch } from '../utils/batchProcessor';
import { publishTranslations } from '../sanity-api/publishDocuments';
import { createTask } from '../adapter/createTask';
import { getTranslationTask } from '../adapter/getTranslationTask';
import { getTranslation } from '../adapter/getTranslation';
import { baseDocumentLevelConfig } from '../configuration/baseDocumentLevelConfig';

interface ImportProgress {
  current: number;
  total: number;
  isImporting: boolean;
}

interface DownloadStatus {
  downloaded: Set<string>;
  failed: Set<string>;
  skipped: Set<string>;
}

interface TranslationStatus {
  progress: number;
  isReady: boolean;
  translationId?: string;
}

interface TranslationsContextType {
  // State
  isBusy: boolean;
  documents: SanityDocument[];
  locales: TranslationLocale[];
  autoRefresh: boolean;
  loadingDocuments: boolean;
  importProgress: ImportProgress;
  importedTranslations: Set<string>;
  existingTranslations: Set<string>;
  downloadStatus: DownloadStatus;
  translationStatuses: Map<string, TranslationStatus>;
  isRefreshing: boolean;
  loadingSecrets: boolean;
  secrets: Secrets | null;

  // Single document task-based functionality (for tab components)
  documentInfo?: GTFile;
  currentTask?: TranslationTask | null;

  // Actions
  setAutoRefresh: (value: boolean) => void;
  handleTranslateAll: () => Promise<void>;
  handleImportAll: () => Promise<void>;
  handleImportMissing: () => Promise<void>;
  handleRefreshAll: () => Promise<void>;
  handleImportDocument: (documentId: string, localeId: string) => Promise<void>;
  handlePatchDocumentReferences: () => Promise<void>;
  handlePublishAllTranslations: () => Promise<void>;

  // Task-based actions (for single document mode)
  handleCreateTask?: (selectedLocales: string[]) => Promise<void>;
  handleRefreshTask?: () => Promise<void>;
  handleImportTaskTranslation?: (localeId: string) => Promise<void>;
}

const TranslationsContext = createContext<TranslationsContextType | null>(null);

export const useTranslations = () => {
  const context = useContext(TranslationsContext);
  if (!context) {
    throw new Error('useTranslations must be used within TranslationsProvider');
  }
  return context;
};

interface TranslationsProviderProps {
  children: ReactNode;
  singleDocument?: SanityDocument | null;
}

export const TranslationsProvider: React.FC<TranslationsProviderProps> = ({
  children,
  singleDocument,
}) => {
  const [isBusy, setIsBusy] = useState(false);
  const [documents, setDocuments] = useState<SanityDocument[]>([]);
  const [locales, setLocales] = useState<TranslationLocale[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    isImporting: false,
  });
  const [importedTranslations, setImportedTranslations] = useState<Set<string>>(
    new Set()
  );
  const [existingTranslations, setExistingTranslations] = useState<Set<string>>(
    new Set()
  );
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({
    downloaded: new Set<string>(),
    failed: new Set<string>(),
    skipped: new Set<string>(),
  });
  const [translationStatuses, setTranslationStatuses] = useState<
    Map<string, TranslationStatus>
  >(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTask, setCurrentTask] = useState<TranslationTask | null>(null);

  const client = useClient();
  const schema = useSchema();
  const translationContext: TranslationFunctionContext = { client, schema };
  const toast = useToast();
  const { loading: loadingSecrets, secrets } = useSecrets<Secrets>(
    `${pluginConfig.getSecretsNamespace()}.secrets`
  );

  const fetchDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    try {
      if (singleDocument) {
        setDocuments([singleDocument]);
        return;
      }

      const translateDocuments = pluginConfig.getTranslateDocuments();

      const filterConditions = translateDocuments
        .map((filter) => {
          if (filter.type && filter.documentId) {
            return `(_type == "${filter.type}" && _id == "${filter.documentId}")`;
          } else if (filter.type) {
            return `_type == "${filter.type}"`;
          } else if (filter.documentId) {
            return `_id == "${filter.documentId}"`;
          }
          return null;
        })
        .filter(Boolean);

      const languageField = pluginConfig.getLanguageField();
      const sourceLocale = pluginConfig.getSourceLocale();
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
  }, [client, toast, singleDocument]);

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

  const fetchExistingTranslations = useCallback(async () => {
    if (!documents.length || !locales.length) return;

    try {
      const sourceLocale = pluginConfig.getSourceLocale();
      const availableLocaleIds = locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId);

      const documentIds = documents.map(
        (doc) => doc._id?.replace('drafts.', '') || doc._id
      );

      const query = `*[
        _type == 'translation.metadata' &&
        translations[_key == $sourceLocale][0].value._ref in $documentIds
      ] {
        'sourceDocId': translations[_key == $sourceLocale][0].value._ref,
        'existingTranslations': translations[_key in $localeIds]._key
      }`;

      const existingMetadata = await client.fetch(query, {
        sourceLocale,
        documentIds,
        localeIds: availableLocaleIds,
      });

      const existing = new Set<string>();
      existingMetadata.forEach((metadata: any) => {
        metadata.existingTranslations?.forEach((localeId: string) => {
          if (localeId !== sourceLocale) {
            existing.add(`${metadata.sourceDocId}:${localeId}`);
          }
        });
      });

      setExistingTranslations(existing);
    } catch (error) {
      console.error('Error fetching existing translations:', error);
      toast.push({
        title: 'Error fetching existing translations',
        status: 'error',
        closable: true,
      });
    }
  }, [documents, locales, client, toast]);

  const handleTranslateAll = useCallback(async () => {
    if (!secrets || documents.length === 0) return;

    setIsBusy(true);

    try {
      const availableLocaleIds = locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId);

      const transformedDocuments = documents
        .map((doc) => {
          delete doc[pluginConfig.getLanguageField()];
          const baseLanguage = pluginConfig.getSourceLocale();
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
  }, [secrets, documents, locales, toast, schema]);

  const handleImportAll = useCallback(async () => {
    if (!secrets || documents.length === 0) return;

    setIsBusy(true);

    try {
      const readyFiles = await getReadyFilesForImport(
        documents,
        translationStatuses
      );

      if (readyFiles.length === 0) {
        toast.push({
          title: 'No ready translations to import',
          status: 'warning',
          closable: true,
        });
        return;
      }

      setImportProgress({
        current: 0,
        total: readyFiles.length,
        isImporting: true,
      });

      const importOptions: ImportOptions = {
        onProgress: (current, total) => {
          setImportProgress({
            current,
            total,
            isImporting: true,
          });
        },
        onImportSuccess: (key) => {
          setImportedTranslations((prev) => new Set([...prev, key]));
        },
      };

      const result = await importTranslations(
        readyFiles,
        secrets,
        translationContext,
        importOptions
      );

      if (result.successfulImports.length > 0) {
        const newDownloadStatus = {
          ...downloadStatus,
          downloaded: new Set([
            ...downloadStatus.downloaded,
            ...result.successfulImports,
          ]),
        };
        setDownloadStatus(newDownloadStatus);
      }

      toast.push({
        title: `Imported ${result.successCount} translations${result.failureCount > 0 ? `, ${result.failureCount} failed` : ''}`,
        status: result.successCount > 0 ? 'success' : 'error',
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
    translationContext,
  ]);

  const getMissingTranslations = useCallback(
    async (
      documentIds: string[],
      localeIds: string[]
    ): Promise<Set<string>> => {
      const sourceLocale = pluginConfig.getSourceLocale();

      const query = `*[
      _type == 'translation.metadata' &&
      translations[_key == $sourceLocale][0].value._ref in $documentIds
    ] {
      'sourceDocId': translations[_key == $sourceLocale][0].value._ref,
      'existingTranslations': translations[_key in $localeIds]._key
    }`;

      const existingMetadata = await client.fetch(query, {
        sourceLocale,
        documentIds,
        localeIds,
      });

      const existing = new Set<string>();
      existingMetadata.forEach((metadata: any) => {
        metadata.existingTranslations?.forEach((localeId: string) => {
          if (localeId !== sourceLocale) {
            existing.add(`${metadata.sourceDocId}:${localeId}`);
          }
        });
      });

      const missing = new Set<string>();
      documentIds.forEach((docId) => {
        localeIds.forEach((localeId) => {
          if (localeId !== sourceLocale) {
            const key = `${docId}:${localeId}`;
            if (!existing.has(key)) {
              missing.add(key);
            }
          }
        });
      });

      return missing;
    },
    [client]
  );

  const handleImportMissing = useCallback(async () => {
    if (!secrets || documents.length === 0) return;

    setIsBusy(true);

    try {
      const availableLocaleIds = locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId);

      const documentIds = documents.map(
        (doc) => doc._id?.replace('drafts.', '') || doc._id
      );

      const missingTranslations = await getMissingTranslations(
        documentIds,
        availableLocaleIds
      );

      console.log('missingTranslations', missingTranslations);
      const readyFiles = await getReadyFilesForImport(
        documents,
        translationStatuses,
        {
          filterReadyFiles: (key) => missingTranslations.has(key),
        }
      );

      if (readyFiles.length === 0) {
        toast.push({
          title: 'No missing translations to import',
          status: 'warning',
          closable: true,
        });
        return;
      }

      setImportProgress({
        current: 0,
        total: readyFiles.length,
        isImporting: true,
      });

      const importOptions: ImportOptions = {
        onProgress: (current, total) => {
          setImportProgress({
            current,
            total,
            isImporting: true,
          });
        },
        onImportSuccess: (key) => {
          setImportedTranslations((prev) => new Set([...prev, key]));
          setExistingTranslations((prev) => new Set([...prev, key]));
        },
      };

      const result = await importTranslations(
        readyFiles,
        secrets,
        translationContext,
        importOptions
      );

      if (result.successfulImports.length > 0) {
        const newDownloadStatus = {
          ...downloadStatus,
          downloaded: new Set([
            ...downloadStatus.downloaded,
            ...result.successfulImports,
          ]),
        };
        setDownloadStatus(newDownloadStatus);
      }

      toast.push({
        title: `Imported ${result.successCount} missing translations${result.failureCount > 0 ? `, ${result.failureCount} failed` : ''}`,
        status: result.successCount > 0 ? 'success' : 'error',
        closable: true,
      });
    } catch (error) {
      console.error('Error importing missing translations:', error);
      toast.push({
        title: 'Error importing missing translations',
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
    locales,
    translationStatuses,
    downloadStatus,
    toast,
    translationContext,
    getMissingTranslations,
  ]);

  const handleRefreshAll = useCallback(async () => {
    if (!secrets || documents.length === 0) return;

    setIsRefreshing(true);

    try {
      const availableLocaleIds = locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId);

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

      const readyTranslations = await checkTranslationStatus(
        fileQueryData,
        downloadStatus,
        secrets
      );

      const newStatuses = new Map(translationStatuses);

      for (const doc of documents) {
        for (const localeId of availableLocaleIds) {
          const documentId = doc._id?.replace('drafts.', '') || doc._id;
          const key = `${documentId}:${localeId}`;
          newStatuses.set(key, { progress: 0, isReady: false });
        }
      }

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
              false
            );

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
      translationContext,
    ]
  );

  const handlePatchDocumentReferences = useCallback(async () => {
    if (!secrets || documents.length === 0) return;

    setIsBusy(true);

    try {
      const availableLocaleIds = locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId);

      const patchTasks: Array<{ doc: SanityDocument; localeId: string }> = [];
      for (const doc of documents) {
        for (const localeId of availableLocaleIds) {
          patchTasks.push({ doc, localeId });
        }
      }

      setImportProgress({
        current: 0,
        total: patchTasks.length,
        isImporting: true,
      });

      const result = await processBatch(
        patchTasks,
        async ({ doc, localeId }) => {
          const sourceLocale = pluginConfig.getSourceLocale();

          // Skip source locale - only process translated documents
          if (localeId === sourceLocale) {
            return { patched: false, doc, localeId, skipped: true };
          }

          // Find the translated document for this locale
          const translatedDoc = await findTranslatedDocumentForLocale(
            doc._id,
            localeId,
            client
          );

          if (!translatedDoc) {
            return { patched: false, doc, localeId, noTranslation: true };
          }

          const resolvedDoc = await resolveRefs(
            translatedDoc,
            localeId,
            client
          );

          if (resolvedDoc !== translatedDoc) {
            const mutation = {
              patch: {
                id: translatedDoc._id,
                set: resolvedDoc,
              },
            };

            await client.mutate([mutation]);
            return { patched: true, doc: translatedDoc, localeId };
          }
          return { patched: false, doc: translatedDoc, localeId };
        },
        {
          onProgress: (current, total) => {
            setImportProgress({
              current,
              total,
              isImporting: true,
            });
          },
          onItemFailure: ({ doc, localeId }, error) => {
            console.error(
              `Failed to patch references for ${doc._id} (${localeId}):`,
              error
            );
          },
        }
      );

      const patchedCount = result.successfulItems.filter(
        (item) => item.patched
      ).length;

      toast.push({
        title: `Patched references in ${patchedCount} documents${result.failureCount > 0 ? `, ${result.failureCount} failed` : ''}`,
        status:
          patchedCount > 0 || result.failureCount === 0 ? 'success' : 'error',
        closable: true,
      });
    } catch (error) {
      console.error('Error patching document references:', error);
      toast.push({
        title: 'Error patching document references',
        status: 'error',
        closable: true,
      });
    } finally {
      setIsBusy(false);
      setImportProgress({ current: 0, total: 0, isImporting: false });
    }
  }, [secrets, documents, locales, toast, client]);

  const handlePublishAllTranslations = useCallback(async () => {
    if (!secrets || documents.length === 0) return;

    setIsBusy(true);

    try {
      const sourceLocale = pluginConfig.getSourceLocale();
      const publishedDocumentIds = documents
        .filter((doc) => !doc._id.startsWith('drafts.'))
        .map((doc) => doc._id);

      if (publishedDocumentIds.length === 0) {
        toast.push({
          title:
            'No published source documents found to publish translations for',
          status: 'warning',
          closable: true,
        });
        return;
      }

      const query = `*[
        _type == 'translation.metadata' &&
        translations[_key == $sourceLocale][0].value._ref in $publishedDocumentIds
      ] {
        'sourceDocId': translations[_key == $sourceLocale][0].value._ref,
        'translationDocs': translations[_key != $sourceLocale && defined(value._ref)]{
          _key,
          'docId': value._ref
        }
      }`;

      const translationMetadata = await client.fetch(query, {
        sourceLocale,
        publishedDocumentIds,
      });

      const translationDocIds: string[] = [];
      translationMetadata.forEach((metadata: any) => {
        metadata.translationDocs?.forEach((translation: any) => {
          if (translation.docId) {
            translationDocIds.push(translation.docId);
          }
        });
      });

      if (translationDocIds.length === 0) {
        toast.push({
          title: 'No translation documents found to publish',
          status: 'warning',
          closable: true,
        });
        return;
      }

      const translatedDocumentIds = await publishTranslations(
        translationDocIds,
        client
      );

      toast.push({
        title: `Published ${translatedDocumentIds.length} translation documents`,
        status: 'success',
        closable: true,
      });
    } catch (error) {
      console.error('Error publishing translations:', error);
      toast.push({
        title: 'Error publishing translations',
        status: 'error',
        closable: true,
      });
    } finally {
      setIsBusy(false);
    }
  }, [secrets, documents, client, toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (secrets) {
      fetchLocales();
    }
  }, [fetchLocales, secrets]);

  useEffect(() => {
    if (documents.length > 0 && locales.length > 0) {
      fetchExistingTranslations();
    }
  }, [fetchExistingTranslations]);

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

  useEffect(() => {
    if (!autoRefresh || documents.length === 0 || !secrets) return;

    const interval = setInterval(async () => {
      await handleRefreshAll();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, documents.length, secrets, handleRefreshAll]);

  useEffect(() => {
    setImportedTranslations(new Set(downloadStatus.downloaded));
  }, [downloadStatus.downloaded]);

  // Create documentInfo for single document mode
  const documentInfo = singleDocument
    ? {
        documentId: singleDocument._id.replace('drafts.', ''),
        versionId: singleDocument._rev,
      }
    : undefined;

  // Task-based functionality for single document mode
  const handleCreateTask = useCallback(
    async (selectedLocales: string[]) => {
      if (!documentInfo || !secrets) return;

      setIsBusy(true);
      try {
        const serializedDocument =
          await baseDocumentLevelConfig.exportForTranslation(
            documentInfo,
            translationContext
          );

        const task = await createTask(
          documentInfo,
          serializedDocument,
          selectedLocales,
          secrets
        );

        setCurrentTask(task);
      } finally {
        setIsBusy(false);
      }
    },
    [documentInfo, secrets, translationContext]
  );

  const handleRefreshTask = useCallback(async () => {
    if (!documentInfo || !secrets) return;

    try {
      const task = await getTranslationTask(documentInfo, secrets);
      setCurrentTask(task);
    } catch (error) {
      console.error('Error refreshing task:', error);
      // If no task found, that's okay - just set to null
      setCurrentTask(null);
    }
  }, [documentInfo, secrets]);

  const handleImportTaskTranslation = useCallback(
    async (localeId: string) => {
      if (!documentInfo || !secrets) return;

      try {
        const translation = await getTranslation(
          documentInfo,
          localeId,
          secrets
        );
        await baseDocumentLevelConfig.importTranslation(
          documentInfo,
          localeId,
          translation,
          translationContext,
          false
        );
      } catch (error) {
        console.error('Error importing task translation:', error);
        throw error;
      }
    },
    [documentInfo, secrets, translationContext]
  );

  // Load task for single document mode
  useEffect(() => {
    if (documentInfo && secrets && !loadingSecrets) {
      handleRefreshTask();
    }
  }, [documentInfo, secrets, loadingSecrets, handleRefreshTask]);

  const contextValue: TranslationsContextType = {
    // State
    isBusy,
    documents,
    locales,
    autoRefresh,
    loadingDocuments,
    importProgress,
    importedTranslations,
    existingTranslations,
    downloadStatus,
    translationStatuses,
    isRefreshing,
    loadingSecrets,
    secrets,

    // Single document task-based functionality
    documentInfo,
    currentTask,

    // Actions
    setAutoRefresh,
    handleTranslateAll,
    handleImportAll,
    handleImportMissing,
    handleRefreshAll,
    handleImportDocument,
    handlePatchDocumentReferences,
    handlePublishAllTranslations,

    // Task-based actions (for single document mode)
    handleCreateTask,
    handleRefreshTask,
    handleImportTaskTranslation,
  };

  return (
    <TranslationsContext.Provider value={contextValue}>
      {children}
    </TranslationsContext.Provider>
  );
};
