import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { SanityDocument, useSchema } from 'sanity';
import { useToast } from '@sanity/ui/toast';
import { useClient } from '../hooks/useClient';
import { useSecrets } from '../hooks/useSecrets';
import {
  GTFile,
  Secrets,
  TranslationLocale,
  TranslationFunctionContext,
} from '../types';
import { gt, overrideConfig, pluginConfig } from '../adapter/core';
import { getTranslationStrategy } from '../translation/strategy';
import { uploadFiles } from '../translation/uploadFiles';
import { initProject } from '../translation/initProject';
import { createJobs } from '../translation/createJobs';
import { captureExistingTranslations } from '../translation/captureExistingTranslations';
import { collectExistingTranslations } from '../translation/collectExistingTranslations';
import { uploadTranslations } from '../translation/uploadTranslations';
import { downloadTranslations } from '../translation/downloadTranslations';
import { checkTranslationStatus } from '../translation/checkTranslationStatus';
import { importDocument } from '../translation/importDocument';
import { commitResolvedRefs, resolveRefs } from '../sanity-api/resolveRefs';
import { findTranslatedDocumentForLocale } from '../sanity-api/findDocuments';
import {
  getReadyFilesForImport,
  importTranslations,
  ImportOptions,
} from '../utils/importUtils';
import { processBatch } from '../utils/batchProcessor';
import {
  publishTranslations,
  TRANSLATION_DOCS_FOR_PUBLISH_QUERY,
} from '../sanity-api/publishDocuments';
import { getLocales } from '../adapter/getLocales';
import type {
  FileProperties,
  TranslationPreferences,
  TranslationStatus,
} from '../adapter/types';
import {
  createStableTranslationKey,
  createTranslationStatusKey,
  dedupeDocumentsPreferDraft,
  getDocumentPublishedId,
  getPublishedId,
} from '../utils/documentIds';
import {
  getPreferencesStorageKey,
  readPreferences,
  writePreferences,
} from '../utils/translationPreferences';

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

type ExistingTranslationMetadata = {
  sourceDocId: string;
  existingTranslations?: string[];
};

type TranslationDocumentMetadata = {
  translationDocs?: { docId?: string }[];
};

export type TranslateAllOptions = {
  /**
   * Discard the translations GT already holds and retranslate from source.
   * Also skips capturing Studio-side edits — capturing them would immediately
   * be reused as the baseline, which is the opposite of what a retranslate is
   * asking for.
   */
  force?: boolean;
};

interface TranslationsContextType {
  // State
  isBusy: boolean;
  documents: SanityDocument[];
  locales: TranslationLocale[];
  autoRefresh: boolean;
  autoImport: boolean;
  autoPatchReferences: boolean;
  autoPublish: boolean;
  preserveExistingTranslations: boolean;
  loadingDocuments: boolean;
  importProgress: ImportProgress;
  importedTranslations: Set<string>;
  existingTranslations: Set<string>;
  downloadStatus: DownloadStatus;
  translationStatuses: Map<string, TranslationStatus>;
  /**
   * Status keys enqueued this session and not yet reported ready. Non-empty
   * means General Translation is still working, which nothing else in the
   * status map distinguishes from "never translated" — both read as 0%.
   */
  pendingTranslations: Set<string>;
  /**
   * Status keys currently being written to Sanity. `importProgress` only counts
   * how many are done, so without this a locale row cannot tell "queued in this
   * import" from "not part of it" while a bulk import runs.
   */
  importingTranslations: Set<string>;
  isRefreshing: boolean;
  loadingSecrets: boolean;
  secrets: Secrets | null;
  branchId: string | undefined;
  // Version to use for translation status keys and GT file queries. Prefers
  // the _rev pinned at upload time over the live _rev, so in-place imports
  // (internationalized arrays) bumping the document _rev don't orphan the
  // statuses of the version actually uploaded to GT.
  getVersionId: (document: SanityDocument) => string;

  // Actions
  setLocales: (locales: TranslationLocale[]) => void;
  setAutoRefresh: (value: boolean) => void;
  setAutoImport: (value: boolean) => void;
  setAutoPatchReferences: (value: boolean) => void;
  setAutoPublish: (value: boolean) => void;
  setPreserveExistingTranslations: (value: boolean) => void;
  handleTranslateAll: (options?: TranslateAllOptions) => Promise<void>;
  handleUploadExistingTranslations: () => Promise<void>;
  handleImportAll: () => Promise<void>;
  handleImportMissing: () => Promise<void>;
  handleRefreshAll: (options?: { silent?: boolean }) => Promise<void>;
  handleImportDocument: (
    documentId: string,
    versionId: string,
    localeId: string
  ) => Promise<void>;
  handlePatchDocumentReferences: () => Promise<number>;
  handlePublishAllTranslations: () => Promise<number>;
}

const TranslationsContext = createContext<TranslationsContextType | null>(null);

// Pinned upload versions are mirrored to sessionStorage so they survive a
// Studio page refresh: falling back to the live document._rev after a refresh
// would query GT with a version that was never uploaded (in-place imports bump
// the _rev), making completed translations show as "not started". Keyed by
// project + dataset so Studios sharing an origin don't collide.
const getUploadedVersionsStorageKey = (
  projectId: string | undefined,
  dataset: string | undefined
) => `gt-sanity:uploadedVersions:${projectId ?? ''}:${dataset ?? ''}`;

function readUploadedVersions(storageKey: string): Map<string, string> {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed)) return new Map();
    return new Map(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    );
  } catch {
    return new Map();
  }
}

function writeUploadedVersions(
  storageKey: string,
  versions: Map<string, string>
): void {
  try {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify(Object.fromEntries(versions))
    );
  } catch {
    // sessionStorage unavailable (SSR, private mode, quota) — pinned versions
    // fall back to in-memory only.
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
  const downloadStatusRef = useRef(downloadStatus);
  const [translationStatuses, setTranslationStatuses] = useState<
    Map<string, TranslationStatus>
  >(new Map());
  const [pendingTranslations, setPendingTranslations] = useState<Set<string>>(
    new Set()
  );
  const [importingTranslations, setImportingTranslations] = useState<
    Set<string>
  >(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const client = useClient();
  const { projectId, dataset } = client.config();
  const uploadedVersionsStorageKey = getUploadedVersionsStorageKey(
    projectId,
    dataset
  );
  const [uploadedVersions, setUploadedVersions] = useState<Map<string, string>>(
    () => readUploadedVersions(uploadedVersionsStorageKey)
  );
  const preferencesStorageKey = getPreferencesStorageKey(projectId, dataset);
  const [preferences, setPreferences] = useState<TranslationPreferences>(() =>
    readPreferences(preferencesStorageKey, pluginConfig.getPreferences())
  );
  const {
    autoRefresh,
    autoImport,
    autoPatchReferences,
    autoPublish,
    preserveExistingTranslations,
  } = preferences;

  // Persist from the event handler rather than an effect: these only ever
  // change in response to the user flipping a switch.
  const setPreference = useCallback(
    (key: keyof TranslationPreferences, value: boolean) => {
      const next = { ...preferences, [key]: value };
      setPreferences(next);
      writePreferences(preferencesStorageKey, next);
    },
    [preferences, preferencesStorageKey]
  );
  const setAutoRefresh = useCallback(
    (value: boolean) => setPreference('autoRefresh', value),
    [setPreference]
  );
  const setAutoImport = useCallback(
    (value: boolean) => setPreference('autoImport', value),
    [setPreference]
  );
  const setAutoPatchReferences = useCallback(
    (value: boolean) => setPreference('autoPatchReferences', value),
    [setPreference]
  );
  const setAutoPublish = useCallback(
    (value: boolean) => setPreference('autoPublish', value),
    [setPreference]
  );
  const setPreserveExistingTranslations = useCallback(
    (value: boolean) => setPreference('preserveExistingTranslations', value),
    [setPreference]
  );
  const schema = useSchema();
  const translationContext: TranslationFunctionContext = { client, schema };
  const toast = useToast();
  const { loading: loadingSecrets, secrets } = useSecrets<Secrets>(
    pluginConfig.getSecretsNamespace()
  );
  const [branchId, setBranchId] = useState<string | undefined>(undefined);

  useEffect(() => {
    downloadStatusRef.current = downloadStatus;
  }, [downloadStatus]);

  const getVersionId = useCallback(
    (document: SanityDocument) =>
      uploadedVersions.get(getDocumentPublishedId(document)) ?? document._rev,
    [uploadedVersions]
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
      setDocuments(dedupeDocumentsPreferDraft(docs));
    } catch {
      toast.push({
        title:
          'Documents could not be loaded. Check your Sanity connection and try refreshing.',
        status: 'error',
        closable: true,
      });
    } finally {
      setLoadingDocuments(false);
    }
  }, [client, singleDocument]);

  const fetchLocales = useCallback(async () => {
    if (!secrets) return;
    try {
      const availableLocales = await getLocales(secrets);
      setLocales(availableLocales);
    } catch {
      toast.push({
        title:
          'Locales could not be loaded. Check your General Translation credentials and try again.',
        status: 'error',
        closable: true,
      });
    }
  }, [secrets]);

  const fetchExistingTranslations = useCallback(async () => {
    if (!documents.length || !locales.length) return;

    try {
      const sourceLocale = pluginConfig.getSourceLocale();
      const availableLocaleIds = locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId);

      const documentIds = documents.map(getDocumentPublishedId);

      const query = `*[
        _type == 'translation.metadata' &&
        translations[language == $sourceLocale][0].value._ref in $documentIds
      ] {
        'sourceDocId': translations[language == $sourceLocale][0].value._ref,
        'existingTranslations': translations[language in $localeIds].language
      }`;

      const existingMetadata = await client.fetch<
        ExistingTranslationMetadata[]
      >(query, {
        sourceLocale,
        documentIds,
        localeIds: availableLocaleIds,
      });

      const existing = new Set<string>();
      existingMetadata.forEach((metadata) => {
        metadata.existingTranslations?.forEach((localeId: string) => {
          if (localeId !== sourceLocale) {
            existing.add(
              createStableTranslationKey(
                undefined,
                metadata.sourceDocId,
                localeId
              )
            );
          }
        });
      });

      setExistingTranslations(existing);
    } catch (error) {
      console.error('Error fetching existing translations:', error);
      toast.push({
        title:
          'Existing translations could not be loaded. Try refreshing before importing.',
        status: 'error',
        closable: true,
      });
    }
  }, [documents, locales, client]);

  const serializeSourceDocuments = useCallback(
    () =>
      documents
        .map((doc) => {
          const { [pluginConfig.getLanguageField()]: _, ...cleanDoc } = doc;
          const baseLanguage = pluginConfig.getSourceLocale();
          try {
            const strategy = getTranslationStrategy(doc);
            return {
              info: {
                documentId: getDocumentPublishedId(doc),
                versionId: doc._rev,
              },
              serializedDocument: strategy.serialize(
                cleanDoc as typeof doc,
                schema,
                baseLanguage
              ),
            };
          } catch (error) {
            console.error('Error transforming document', doc._id, error);
          }
          return null;
        })
        .filter((doc) => doc !== null),
    [documents, schema]
  );

  const handleTranslateAll = useCallback(
    async ({ force = false }: TranslateAllOptions = {}) => {
      if (!secrets || documents.length === 0) return;

      setIsBusy(true);

      try {
        const availableLocaleIds = locales
          .filter((locale) => locale.enabled !== false)
          .map((locale) => locale.localeId);

        // Send any Studio-side edits to existing translations back to GT first,
        // pinned to the source version they belong to. This has to happen before
        // the upload below, which makes the new revision the latest version and
        // would leave the edits attached to nothing. Best-effort: a failure here
        // costs edit preservation, and must not block the translation itself.
        if (preserveExistingTranslations && !force) {
          try {
            const captured = await captureExistingTranslations({
              documents,
              localeIds: availableLocaleIds,
              secrets,
              context: translationContext,
              branchId,
            });
            if (captured.capturedCount > 0) {
              toast.push({
                title: `Preserved ${captured.capturedCount} existing translation(s) across ${captured.documentCount} document(s)`,
                status: 'info',
                closable: true,
              });
            }
          } catch (error) {
            console.error(
              'Could not preserve existing translations. Continuing — edits made to translated documents may be overwritten by this run.',
              error
            );
            toast.push({
              title:
                'Existing translations could not be preserved. Translation is continuing, but edits made to translated documents may be overwritten.',
              status: 'warning',
              closable: true,
            });
          }
        }

        const transformedDocuments = serializeSourceDocuments();

        const uploadResult = await uploadFiles(transformedDocuments, secrets);
        await initProject(uploadResult, { timeout: 600 }, secrets);
        await createJobs(uploadResult, availableLocaleIds, secrets, force);

        // Pin the _rev each file was uploaded under. GT status queries need the
        // exact uploaded versionId, and the live _rev moves on (in-place array
        // imports bump it), so status lookups go through getVersionId instead.
        // Persisted to sessionStorage so the pins survive a page refresh.
        const nextUploadedVersions = new Map(uploadedVersions);
        for (const { info } of transformedDocuments) {
          if (info.versionId) {
            nextUploadedVersions.set(info.documentId, info.versionId);
          }
        }
        writeUploadedVersions(uploadedVersionsStorageKey, nextUploadedVersions);
        setUploadedVersions(nextUploadedVersions);

        const enqueuedStatusKeys = new Set<string>();
        const enqueuedStableKeys = new Set<string>();
        for (const { info } of transformedDocuments) {
          for (const localeId of availableLocaleIds) {
            enqueuedStatusKeys.add(
              createTranslationStatusKey(
                branchId,
                info.documentId,
                info.versionId ?? '',
                localeId
              )
            );
            enqueuedStableKeys.add(
              createStableTranslationKey(branchId, info.documentId, localeId)
            );
          }
        }

        // A key already downloaded this session is skipped by the status
        // query, so re-translating one would leave it outstanding forever:
        // enqueued as pending, never reported ready, never cleared. Drop the
        // markers for everything being retranslated — the previous download is
        // superseded by the run starting now.
        setDownloadStatus((prev) => ({
          downloaded: new Set(
            [...prev.downloaded].filter(
              (key) =>
                !enqueuedStatusKeys.has(key) && !enqueuedStableKeys.has(key)
            )
          ),
          failed: new Set(
            [...prev.failed].filter(
              (key) =>
                !enqueuedStatusKeys.has(key) && !enqueuedStableKeys.has(key)
            )
          ),
          skipped: new Set(
            [...prev.skipped].filter(
              (key) =>
                !enqueuedStatusKeys.has(key) && !enqueuedStableKeys.has(key)
            )
          ),
        }));

        // Everything just enqueued is outstanding until a refresh reports it
        // ready. Without this the UI cannot tell "General Translation is
        // working on it" from "never translated" — both sit at 0%.
        setPendingTranslations(
          (prev) => new Set([...prev, ...enqueuedStatusKeys])
        );

        toast.push({
          title: force
            ? `Retranslating ${documents.length} documents from scratch`
            : `Translation tasks created for ${documents.length} documents`,
          status: 'success',
          closable: true,
        });
      } catch {
        toast.push({
          title:
            'Translation tasks could not be created. No documents were changed. Try again or check the console for details.',
          status: 'error',
          closable: true,
        });
      } finally {
        setIsBusy(false);
      }
    },
    [
      secrets,
      documents,
      locales,
      schema,
      client,
      branchId,
      preserveExistingTranslations,
      serializeSourceDocuments,
      uploadedVersions,
      uploadedVersionsStorageKey,
    ]
  );

  const handleUploadExistingTranslations = useCallback(async () => {
    if (!secrets || documents.length === 0) return;

    setIsBusy(true);
    try {
      const availableLocaleIds = locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId);

      const transformedDocuments = serializeSourceDocuments();

      // Seed the source files first. uploadTranslations requires the source to
      // exist, and this action exists for projects whose translations predate
      // General Translation, where no source has been uploaded yet. Enqueueing
      // is deliberately skipped so nothing is retranslated.
      await uploadFiles(transformedDocuments, secrets);

      const existing = await collectExistingTranslations(
        documents,
        availableLocaleIds,
        translationContext
      );
      const withTranslations = transformedDocuments
        .map((document) => ({
          ...document,
          translations: existing.get(document.info.documentId) ?? [],
        }))
        .filter((document) => document.translations.length > 0);

      const response = await uploadTranslations(withTranslations, secrets);
      const count = response?.uploadedFiles.length ?? 0;

      toast.push({
        title:
          count > 0
            ? `Uploaded ${count} existing translation(s) across ${withTranslations.length} document(s)`
            : 'No existing translations found to upload',
        status: count > 0 ? 'success' : 'warning',
        closable: true,
      });
    } catch (error) {
      console.error('Error uploading existing translations:', error);
      toast.push({
        title:
          'Existing translations could not be uploaded. No documents were changed. Try again or check the console for details.',
        status: 'error',
        closable: true,
      });
    } finally {
      setIsBusy(false);
    }
  }, [secrets, documents, locales, client, schema, serializeSourceDocuments]);

  const handleImportAll = useCallback(async () => {
    if (!secrets || documents.length === 0 || !branchId) return;

    setIsBusy(true);

    try {
      const readyFiles = await getReadyFilesForImport(translationStatuses, {
        onSelectedKeys: (keys) => setImportingTranslations(new Set(keys)),
      });

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
        setDownloadStatus((prev) => ({
          ...prev,
          downloaded: new Set([
            ...prev.downloaded,
            ...result.successfulImports,
          ]),
        }));
      }

      toast.push({
        title: `Imported ${result.successCount} translations${result.failureCount > 0 ? `, ${result.failureCount} failed` : ''}`,
        status: result.successCount > 0 ? 'success' : 'error',
        closable: true,
      });
    } catch (error) {
      console.error('Error importing translations:', error);
      toast.push({
        title:
          'Translations could not be imported. No documents were changed. Try again or check the console for details.',
        status: 'error',
        closable: true,
      });
    } finally {
      setIsBusy(false);
      setImportProgress({ current: 0, total: 0, isImporting: false });
      setImportingTranslations(new Set());
    }
  }, [
    secrets,
    documents,
    translationStatuses,
    downloadStatus,
    translationContext,
    branchId,
  ]);

  const getExistingTranslations = useCallback(
    async (
      documentIds: string[],
      localeIds: string[],
      branchId: string
    ): Promise<Set<string>> => {
      const sourceLocale = pluginConfig.getSourceLocale();

      const query = `*[
      _type == 'translation.metadata' &&
      translations[language == $sourceLocale][0].value._ref in $documentIds
    ] {
      _rev,
      'sourceDocId': translations[language == $sourceLocale][0].value._ref,
      'existingTranslations': translations[language in $localeIds].language
    }`;

      const existingMetadata = await client.fetch<
        ExistingTranslationMetadata[]
      >(query, {
        sourceLocale,
        documentIds,
        localeIds,
      });

      const existing = new Set<string>();
      existingMetadata.forEach((metadata) => {
        metadata.existingTranslations?.forEach((localeId: string) => {
          if (localeId !== sourceLocale) {
            existing.add(
              createStableTranslationKey(
                branchId,
                metadata.sourceDocId,
                localeId
              )
            );
          }
        });
      });

      return existing;
    },
    [client]
  );

  const handleImportMissing = useCallback(async () => {
    if (!secrets || documents.length === 0 || !branchId) return;

    setIsBusy(true);

    try {
      const availableLocaleIds = locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId);

      const documentIds = documents.map(getDocumentPublishedId);

      const existingTranslations = await getExistingTranslations(
        documentIds,
        availableLocaleIds,
        branchId
      );

      const readyFiles = await getReadyFilesForImport(translationStatuses, {
        onSelectedKeys: (keys) => setImportingTranslations(new Set(keys)),
        filterReadyFiles: (_key, status) =>
          !existingTranslations.has(
            createStableTranslationKey(
              branchId,
              status.fileData.fileId,
              status.fileData.locale
            )
          ),
      });

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
        setDownloadStatus((prev) => ({
          ...prev,
          downloaded: new Set([
            ...prev.downloaded,
            ...result.successfulImports,
          ]),
        }));
      }

      toast.push({
        title: `Imported ${result.successCount} missing translations${result.failureCount > 0 ? `, ${result.failureCount} failed` : ''}`,
        status: result.successCount > 0 ? 'success' : 'error',
        closable: true,
      });
    } catch (error) {
      console.error('Error importing missing translations:', error);
      toast.push({
        title:
          'Missing translations could not be imported. No documents were changed. Try again or check the console for details.',
        status: 'error',
        closable: true,
      });
    } finally {
      setIsBusy(false);
      setImportProgress({ current: 0, total: 0, isImporting: false });
      setImportingTranslations(new Set());
    }
  }, [
    secrets,
    documents,
    locales,
    translationStatuses,
    downloadStatus,
    translationContext,
    getExistingTranslations,
    branchId,
  ]);

  const handleGetBranchId = useCallback(
    async (secrets: Secrets) => {
      overrideConfig(secrets);
      const defaultBranch = await gt.createBranch({
        branchName: 'main',
        defaultBranch: true,
      });
      setBranchId(defaultBranch.branch.id);
    },
    [secrets]
  );

  // `silent` suppresses the success toast. The poll runs every 10 seconds, so
  // only a refresh the user asked for should announce itself.
  const handleRefreshAll = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!secrets || documents.length === 0 || !branchId) return;
      setIsRefreshing(true);

      try {
        const availableLocaleIds = locales
          .filter((locale) => locale.enabled !== false)
          .map((locale) => locale.localeId);

        const fileQueryData: FileProperties[] = [];
        for (const doc of documents) {
          for (const localeId of availableLocaleIds) {
            const documentId = getDocumentPublishedId(doc);
            fileQueryData.push({
              versionId: getVersionId(doc),
              fileId: documentId,
              branchId: branchId,
              locale: localeId,
            });
          }
        }

        const readyTranslations = await checkTranslationStatus(
          fileQueryData,
          downloadStatusRef.current,
          secrets
        );

        // Built here rather than inside an updater: it derives from the
        // response, not from previous state, and a state updater has to stay
        // pure — React may run it more than once.
        const newStatuses = new Map<string, TranslationStatus>();

        for (const doc of documents) {
          for (const localeId of availableLocaleIds) {
            const documentId = getDocumentPublishedId(doc);
            const versionId = getVersionId(doc);
            const key = createTranslationStatusKey(
              branchId,
              documentId,
              versionId,
              localeId
            );
            newStatuses.set(key, { progress: 0, isReady: false });
          }
        }

        if (Array.isArray(readyTranslations)) {
          for (const translation of readyTranslations) {
            const key = createTranslationStatusKey(
              branchId,
              translation.fileId,
              translation.versionId,
              translation.locale
            );
            newStatuses.set(key, {
              progress: 100,
              isReady: true,
              fileData: {
                versionId: translation.versionId,
                fileId: translation.fileId,
                branchId: translation.branchId,
                locale: translation.locale,
              },
            });
          }
        }

        setTranslationStatuses(newStatuses);

        // A translation that has arrived is no longer outstanding.
        setPendingTranslations((prev) => {
          if (prev.size === 0) return prev;
          const next = new Set(prev);
          for (const [key, status] of newStatuses) {
            if (status.isReady) next.delete(key);
          }
          return next.size === prev.size ? prev : next;
        });

        if (!silent) {
          toast.push({
            title: `Refreshed status for ${documents.length} document(s)`,
            status: 'success',
            closable: true,
          });
        }
      } catch (error) {
        console.error('Error refreshing translation status:', error);
        toast.push({
          title:
            'Translation status could not be refreshed. Try again before importing.',
          status: 'error',
          closable: true,
        });
      } finally {
        setIsRefreshing(false);
      }
    },
    [secrets, documents, locales, branchId, getVersionId]
  );

  const handleImportDocument = useCallback(
    async (documentId: string, versionId: string, localeId: string) => {
      if (!secrets) return;

      const key = createTranslationStatusKey(
        branchId,
        documentId,
        versionId,
        localeId
      );
      const status = translationStatuses.get(key);

      if (!status?.isReady || !status.fileData) {
        toast.push({
          title: `Translation not ready for ${documentId} (${localeId})`,
          status: 'warning',
          closable: true,
        });
        return;
      }

      const document = documents.find(
        (doc) => getDocumentPublishedId(doc) === getPublishedId(documentId)
      );

      if (!document) {
        toast.push({
          title: `Document ${documentId} not found`,
          status: 'error',
          closable: true,
        });
        return;
      }

      try {
        const downloadedFiles = await downloadTranslations(
          [
            {
              fileId: status.fileData.fileId,
              branchId: status.fileData.branchId,
              versionId: status.fileData.versionId,
              locale: status.fileData.locale,
            },
          ],
          secrets
        );

        if (downloadedFiles.length > 0) {
          try {
            const docInfo: GTFile = {
              documentId: getPublishedId(documentId),
              versionId: document._rev,
            };

            await importDocument(
              docInfo,
              localeId,
              downloadedFiles[0].data,
              translationContext,
              false
            );

            setDownloadStatus((prev) => ({
              ...prev,
              downloaded: new Set([...prev.downloaded, key]),
            }));
            setImportedTranslations((prev) => new Set([...prev, key]));
            setExistingTranslations(
              (prev) =>
                new Set([
                  ...prev,
                  createStableTranslationKey(branchId, documentId, localeId),
                ])
            );

            toast.push({
              title: `Successfully imported translation for ${documentId} (${localeId})`,
              status: 'success',
              closable: true,
            });
          } catch (importError) {
            console.error('Failed to import translation:', importError);
            toast.push({
              title: `Translation for ${documentId} (${localeId}) could not be imported. This document was not changed.`,
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
          title: `Translation for ${documentId} could not be imported. This document was not changed.`,
          status: 'error',
          closable: true,
        });
      }
    },
    [secrets, documents, translationContext, translationStatuses, branchId]
  );

  const handlePatchDocumentReferences = useCallback(async () => {
    if (!secrets || documents.length === 0) return 0;

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
            await commitResolvedRefs(translatedDoc, resolvedDoc, client);
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

      return patchedCount;
    } catch (error) {
      console.error('Error patching document references:', error);
      toast.push({
        title:
          'Document references could not be updated. Imported translations may need to be linked manually.',
        status: 'error',
        closable: true,
      });
      return 0;
    } finally {
      setIsBusy(false);
      setImportProgress({ current: 0, total: 0, isImporting: false });
    }
  }, [secrets, documents, locales, client, branchId]);

  const handlePublishAllTranslations = useCallback(async () => {
    if (!secrets || documents.length === 0) return 0;

    setIsBusy(true);

    try {
      const sourceDocumentIds = documents.map(getDocumentPublishedId);
      const publishedDocumentIds = await client.fetch(
        `*[_id in $sourceDocumentIds]._id`,
        { sourceDocumentIds }
      );

      if (publishedDocumentIds.length === 0) {
        toast.push({
          title:
            'No published source documents found to publish translations for',
          status: 'warning',
          closable: true,
        });
        return 0;
      }

      const translationMetadata = await client.fetch<
        TranslationDocumentMetadata[]
      >(TRANSLATION_DOCS_FOR_PUBLISH_QUERY, {
        publishedDocumentIds,
        sourceDocumentIds,
      });

      const translationDocIds = new Set<string>();
      translationMetadata.forEach((metadata) => {
        metadata.translationDocs?.forEach((translation) => {
          if (translation.docId) {
            translationDocIds.add(translation.docId);
          }
        });
      });

      const publishableIds = Array.from(translationDocIds);

      if (publishableIds.length === 0) {
        toast.push({
          title: 'No translation documents found to publish',
          status: 'warning',
          closable: true,
        });
        return 0;
      }

      const translatedDocumentIds = await publishTranslations(
        publishableIds,
        client
      );

      toast.push({
        title: `Published ${translatedDocumentIds.length} translation documents`,
        status: 'success',
        closable: true,
      });

      return translatedDocumentIds.length;
    } catch (error) {
      console.error('Error publishing translations:', error);
      toast.push({
        title:
          'Translations could not be published. No unpublished source documents were changed.',
        status: 'error',
        closable: true,
      });
      return 0;
    } finally {
      setIsBusy(false);
    }
  }, [secrets, documents, client, branchId]);

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
      !loadingDocuments &&
      branchId
    ) {
      handleRefreshAll({ silent: true });
    }
  }, [
    documents,
    locales,
    secrets,
    loadingDocuments,
    branchId,
    handleRefreshAll,
  ]);

  useEffect(() => {
    if (!autoRefresh || documents.length === 0 || !secrets) return;

    const interval = setInterval(async () => {
      await handleRefreshAll({ silent: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, documents.length, secrets, handleRefreshAll]);

  useEffect(() => {
    setImportedTranslations(new Set(downloadStatus.downloaded));
  }, [downloadStatus.downloaded]);

  useEffect(() => {
    if (secrets) {
      handleGetBranchId(secrets);
    }
  }, [secrets, handleGetBranchId]);

  const contextValue: TranslationsContextType = {
    // State
    isBusy,
    documents,
    locales,
    autoRefresh,
    autoImport,
    autoPatchReferences,
    autoPublish,
    preserveExistingTranslations,
    loadingDocuments,
    importProgress,
    importedTranslations,
    existingTranslations,
    downloadStatus,
    translationStatuses,
    pendingTranslations,
    importingTranslations,
    isRefreshing,
    loadingSecrets,
    secrets,
    branchId,
    getVersionId,

    // Actions
    setLocales,
    setAutoRefresh,
    setAutoImport,
    setAutoPatchReferences,
    setAutoPublish,
    setPreserveExistingTranslations,
    handleTranslateAll,
    handleUploadExistingTranslations,
    handleImportAll,
    handleImportMissing,
    handleRefreshAll,
    handleImportDocument,
    handlePatchDocumentReferences,
    handlePublishAllTranslations,
  };

  return (
    <TranslationsContext.Provider value={contextValue}>
      {children}
    </TranslationsContext.Provider>
  );
};
