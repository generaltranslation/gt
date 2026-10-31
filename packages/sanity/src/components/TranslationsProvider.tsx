import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { SanityDocument, useDocumentStore, useSchema } from 'sanity';
import { useToast } from '@sanity/ui/toast';
import { useClient } from '../hooks/useClient';
import { useSecrets } from '../hooks/useSecrets';
import { useDocumentRole } from '../hooks/useDocumentRole';
import {
  GTFile,
  Secrets,
  TranslationLocale,
  TranslationFunctionContext,
} from '../types';
import { api, overrideConfig, pluginConfig } from '../adapter/core';
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
import {
  getDocumentTargetLocales,
  getLocaleIdsToPoll,
  getSelectedLocaleIds,
} from '../utils/locales';
import {
  allowsNonDefaultSourceLocales,
  EXISTING_TRANSLATIONS_BY_ORIGINAL_QUERY,
  getDocumentLanguage,
  isNonDefaultSourceLanguage,
} from '../utils/translationSource';
import {
  checkTranslatableOriginal,
  type DocumentRoleState,
} from '../utils/documentRoleState';
import {
  getSourceLocaleSelectionQuery,
  recheckBulkSourceDocuments,
  selectBulkSourceDocuments,
} from '../translation/bulkSources';
import { createRefreshTracker } from '../utils/refreshTracker';
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
import { getDocumentFileName } from '../utils/fileNames';
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
  // Only queried for originals outside the configured source locale.
  sourceLanguage?: string;
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

export type PublishTranslationsOptions = {
  /**
   * Publish only translations in these locales. Omitted or `null` publishes
   * every translation of the source documents, whatever its locale.
   */
  localeIds?: string[] | null;
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
  /**
   * The locales a document can be translated into: for an original outside
   * the configured source locale, every locale except its own; otherwise
   * `locales` unchanged.
   */
  getTargetLocales: (document: SanityDocument) => TranslationLocale[];
  /**
   * The locale locale pickers leave out: the open document's language, or the
   * configured source locale on the Translations page.
   */
  excludedLocale: string;
  /**
   * The open document's role in its translation group. `null` on the
   * Translations page.
   */
  documentRole: DocumentRoleState | null;
  /**
   * Originals in scope written outside the configured source locale, which
   * Translate All leaves out; each is translated from the Translate dialog on
   * that document.
   */
  skippedOriginalCount: number;

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
  handlePublishAllTranslations: (
    options?: PublishTranslationsOptions
  ) => Promise<number>;
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

/** The scope and source locale Translate All selects its documents from. */
function getTranslateAllSelection() {
  const filterConditions = pluginConfig
    .getTranslateDocuments()
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

  return {
    scopeFilter:
      filterConditions.length === 0
        ? `!(_type in ["system.group"]) && !(_id in path("_.**"))`
        : `!(_type in ["system.group"]) && !(_id in path("_.**")) && (${filterConditions.join(' || ')})`,
    languageField: pluginConfig.getLanguageField(),
    sourceLocale: pluginConfig.getSourceLocale(),
  };
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

/**
 * Provides translation state and actions to the Translations page and the
 * Translate dialog.
 *
 * The open document's role in its translation group is only looked up with
 * `allowNonDefaultSourceLocales`. Without it, nothing subscribes to or reads
 * translation groups for the role, as before the option existed. The option
 * is fixed for the Studio's lifetime, so the rendered component never
 * switches between the two.
 */
export const TranslationsProvider: React.FC<TranslationsProviderProps> = (
  props
) =>
  allowsNonDefaultSourceLocales() ? (
    <TranslationsProviderWithDocumentRole {...props} />
  ) : (
    <TranslationsProviderContent {...props} documentRole={null} />
  );

const TranslationsProviderWithDocumentRole: React.FC<
  TranslationsProviderProps
> = (props) => {
  const client = useClient();
  const documentStore = useDocumentStore();
  // Looked up apart from loading documents, so it never holds up the first
  // status refresh.
  const documentRole = useDocumentRole({
    documentId: props.singleDocument?._id,
    language: props.singleDocument
      ? getDocumentLanguage(props.singleDocument)
      : undefined,
    client,
    documentStore,
  });
  return <TranslationsProviderContent {...props} documentRole={documentRole} />;
};

const TranslationsProviderContent: React.FC<
  TranslationsProviderProps & { documentRole: DocumentRoleState | null }
> = ({ children, singleDocument, documentRole }) => {
  // Fixed for the Studio's lifetime; see TranslationsProvider.
  const allowNonDefault = allowsNonDefaultSourceLocales();
  const [isBusy, setIsBusy] = useState(false);
  const [documents, setDocuments] = useState<SanityDocument[]>([]);
  // Originals outside the source locale that Translate All leaves out; each is
  // translated from the Translate dialog on that document.
  const [skippedOriginalCount, setSkippedOriginalCount] = useState(0);
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
  const pendingTranslationsRef = useRef(pendingTranslations);
  // Changing what a refresh asks for (locales, documents, their uploaded
  // versions, the branch) starts a new refresh while an older one may still be
  // in flight. The tracker drops responses whose scope is no longer current, so
  // they can't overwrite the statuses of the current one. Replaced with a new
  // object on every change and compared by identity.
  const refreshScopeRef = useRef({});
  const [refreshTracker] = useState(() =>
    createRefreshTracker(() => refreshScopeRef.current)
  );

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

  useEffect(() => {
    pendingTranslationsRef.current = pendingTranslations;
  }, [pendingTranslations]);

  const getVersionId = useCallback(
    (document: SanityDocument) =>
      uploadedVersions.get(getDocumentPublishedId(document)) ?? document._rev,
    [uploadedVersions]
  );

  const getTargetLocales = useCallback(
    (document: SanityDocument) => {
      if (!allowNonDefault) return locales;
      const language = getDocumentLanguage(document);
      return isNonDefaultSourceLanguage(language)
        ? getDocumentTargetLocales(locales, language)
        : locales;
    },
    [allowNonDefault, locales]
  );

  // Only read with `allowNonDefaultSourceLocales`: without it, every document
  // is translated from the configured source locale.
  const singleDocumentLanguage =
    allowNonDefault && singleDocument
      ? getDocumentLanguage(singleDocument)
      : undefined;
  const excludedLocale =
    singleDocumentLanguage ?? pluginConfig.getSourceLocale();
  // Only the document open in the Translate dialog can be an original outside the
  // source locale; Translate All only picks up source-locale originals.
  const hasNonDefaultSource =
    allowNonDefault &&
    documents.some((doc) =>
      isNonDefaultSourceLanguage(getDocumentLanguage(doc))
    );

  // Declared before the effects that refresh on these changes, so a refresh
  // started by one already runs under the new scope.
  useEffect(() => {
    refreshScopeRef.current = {};
  }, [locales, documents, branchId, getVersionId]);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    try {
      if (singleDocument) {
        setDocuments([singleDocument]);
        return;
      }

      if (!allowNonDefault) {
        const docs = await client.fetch(
          getSourceLocaleSelectionQuery(getTranslateAllSelection())
        );
        setDocuments(dedupeDocumentsPreferDraft(docs));
        return;
      }

      // Originals outside the source locale, and translations in their
      // groups, are left out: each such original is translated from the
      // Translate dialog on that document.
      const { documents: docs, skippedOriginalCount } =
        await selectBulkSourceDocuments({
          client,
          ...getTranslateAllSelection(),
        });
      setDocuments(dedupeDocumentsPreferDraft(docs));
      setSkippedOriginalCount(skippedOriginalCount);
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
  }, [allowNonDefault, client, singleDocument]);

  const fetchLocales = useCallback(async () => {
    if (!secrets) return;
    try {
      const availableLocales = await getLocales(
        secrets,
        singleDocumentLanguage
      );
      setLocales(availableLocales);
    } catch {
      toast.push({
        title:
          'Locales could not be loaded. Check your General Translation credentials and try again.',
        status: 'error',
        closable: true,
      });
    }
  }, [secrets, singleDocumentLanguage]);

  const fetchExistingTranslations = useCallback(async () => {
    if (!documents.length || !locales.length) return;

    try {
      const sourceLocale = pluginConfig.getSourceLocale();
      const availableLocaleIds = locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId);

      const documentIds = documents.map(getDocumentPublishedId);

      const query = hasNonDefaultSource
        ? EXISTING_TRANSLATIONS_BY_ORIGINAL_QUERY
        : `*[
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
          if (localeId !== (metadata.sourceLanguage ?? sourceLocale)) {
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
  }, [documents, locales, client, hasNonDefaultSource]);

  const serializeSourceDocuments = useCallback(
    (sourceDocuments: SanityDocument[] = documents) =>
      sourceDocuments
        .map((doc) => {
          const { [pluginConfig.getLanguageField()]: _, ...cleanDoc } = doc;
          try {
            const strategy = getTranslationStrategy(doc);
            // With `allowNonDefaultSourceLocales`, each original is serialized
            // in its own language. Field-level (internationalized-array)
            // documents always use the source locale.
            const baseLanguage =
              allowNonDefault && strategy.level === 'document'
                ? getDocumentLanguage(doc)
                : pluginConfig.getSourceLocale();
            return {
              info: {
                documentId: getDocumentPublishedId(doc),
                versionId: doc._rev,
                fileName: getDocumentFileName(doc),
                ...(isNonDefaultSourceLanguage(baseLanguage) && {
                  sourceLocale: baseLanguage,
                }),
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
    [allowNonDefault, documents, schema]
  );

  // Studio-side translations are only collected for groups whose original is
  // in the configured source locale.
  const getDefaultSourceDocuments = useCallback(
    (sourceDocuments: SanityDocument[] = documents) =>
      hasNonDefaultSource
        ? sourceDocuments.filter(
            (doc) => !isNonDefaultSourceLanguage(getDocumentLanguage(doc))
          )
        : sourceDocuments,
    [documents, hasNonDefaultSource]
  );

  // Only a group's original is ever uploaded as a source. What is on screen
  // may be out of date, so every upload checks its documents again first:
  // the open document's role is looked up afresh, and a Translate All
  // selection is run again for the documents it loaded, dropping any that are
  // no longer originals. Returns null when nothing should be uploaded.
  const getUploadableSources = useCallback(
    async (
      candidates: SanityDocument[],
      abortTitle: string
    ): Promise<SanityDocument[] | null> => {
      if (singleDocument) {
        for (const document of candidates) {
          const check = await checkTranslatableOriginal(document, client);
          if (!check.translatable) {
            toast.push({
              title: abortTitle,
              description: check.message,
              status: 'error',
              closable: true,
            });
            return null;
          }
        }
        return candidates;
      }

      const { documents: eligible, droppedCount } =
        await recheckBulkSourceDocuments({
          client,
          documents: candidates,
          ...getTranslateAllSelection(),
        });
      if (droppedCount > 0) {
        toast.push({
          title: `Skipped ${droppedCount} document(s) that are no longer the original of their translation group`,
          description:
            'They changed after this page loaded. Reload the page to see the current documents.',
          status: 'warning',
          closable: true,
        });
      }
      return eligible.length > 0 ? eligible : null;
    },
    [client, singleDocument, toast]
  );

  const handleTranslateAll = useCallback(
    async ({ force = false }: TranslateAllOptions = {}) => {
      if (!secrets || documents.length === 0) return;

      setIsBusy(true);

      try {
        // Without `allowNonDefaultSourceLocales`, the loaded documents are
        // uploaded as they are.
        const sourceDocuments = allowNonDefault
          ? await getUploadableSources(documents, 'Translation was not started')
          : documents;
        if (!sourceDocuments) return;

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
              documents: getDefaultSourceDocuments(sourceDocuments),
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

        const transformedDocuments = serializeSourceDocuments(sourceDocuments);

        // A document is never translated into its own language. Without
        // `allowNonDefaultSourceLocales`, every document is translated into
        // the selected locales.
        const targetLocaleIdsByDocument = allowNonDefault
          ? new Map(
              sourceDocuments.map((doc) => [
                getDocumentPublishedId(doc),
                getSelectedLocaleIds(getTargetLocales(doc)),
              ])
            )
          : null;
        const enqueueLocaleIds =
          targetLocaleIdsByDocument && hasNonDefaultSource
            ? Array.from(
                new Set([...targetLocaleIdsByDocument.values()].flat())
              )
            : availableLocaleIds;

        const uploadResult = await uploadFiles(transformedDocuments, secrets);
        await initProject(uploadResult, { timeout: 600 }, secrets);
        await createJobs(uploadResult, enqueueLocaleIds, secrets, force);

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
          for (const localeId of targetLocaleIdsByDocument?.get(
            info.documentId
          ) ?? availableLocaleIds) {
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
            ? `Retranslating ${sourceDocuments.length} documents from scratch`
            : `Translation tasks created for ${sourceDocuments.length} documents`,
          status: 'success',
          closable: true,
        });
        if (skippedOriginalCount > 0) {
          toast.push({
            title: `Skipped ${skippedOriginalCount} document(s) written in a locale other than ${pluginConfig.getSourceLocale()}`,
            description:
              'Translate each of them from the Translate dialog on that document.',
            status: 'info',
            closable: true,
          });
        }
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
      allowNonDefault,
      hasNonDefaultSource,
      getTargetLocales,
      getDefaultSourceDocuments,
      getUploadableSources,
      skippedOriginalCount,
    ]
  );

  const handleUploadExistingTranslations = useCallback(async () => {
    if (!secrets || documents.length === 0) return;

    setIsBusy(true);
    try {
      const availableLocaleIds = locales
        .filter((locale) => locale.enabled !== false)
        .map((locale) => locale.localeId);

      let sourceDocuments = documents;
      // Without `allowNonDefaultSourceLocales`, the loaded documents are
      // uploaded as they are.
      if (allowNonDefault) {
        const defaultSourceDocuments = getDefaultSourceDocuments();
        if (defaultSourceDocuments.length === 0) {
          toast.push({
            title: `Local edits can only be saved for translations of ${pluginConfig.getSourceLocale()} documents`,
            status: 'warning',
            closable: true,
          });
          return;
        }
        const uploadable = await getUploadableSources(
          defaultSourceDocuments,
          'Local edits were not saved'
        );
        if (!uploadable) return;
        sourceDocuments = uploadable;
      }
      const transformedDocuments = serializeSourceDocuments(sourceDocuments);

      // Seed the source files first. uploadTranslations requires the source to
      // exist, and this action exists for projects whose translations predate
      // General Translation, where no source has been uploaded yet. Enqueueing
      // is deliberately skipped so nothing is retranslated.
      await uploadFiles(transformedDocuments, secrets);

      const existing = await collectExistingTranslations(
        sourceDocuments,
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
  }, [
    secrets,
    documents,
    locales,
    client,
    schema,
    serializeSourceDocuments,
    allowNonDefault,
    getDefaultSourceDocuments,
    getUploadableSources,
  ]);

  const handleImportAll = useCallback(async () => {
    if (!secrets || documents.length === 0 || !branchId) return;

    setIsBusy(true);

    try {
      // Statuses are refreshed for the selected locales only, but a refresh
      // started by changing the selection may not have landed yet.
      const selectedLocaleIds = new Set(getSelectedLocaleIds(locales));

      const readyFiles = await getReadyFilesForImport(translationStatuses, {
        onSelectedKeys: (keys) => setImportingTranslations(new Set(keys)),
        filterReadyFiles: (_key, status) =>
          selectedLocaleIds.has(status.fileData.locale),
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
    locales,
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

      const query = hasNonDefaultSource
        ? EXISTING_TRANSLATIONS_BY_ORIGINAL_QUERY
        : `*[
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
          if (localeId !== (metadata.sourceLanguage ?? sourceLocale)) {
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
    [client, hasNonDefaultSource]
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
          availableLocaleIds.includes(status.fileData.locale) &&
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
      const defaultBranch = await api.createBranch({
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
      const refresh = refreshTracker.begin();
      setIsRefreshing(true);

      try {
        // Selected locales, plus any still translating. A locale deselected
        // mid-run keeps being polled until it reports ready, or its pending
        // marker would never clear and Translate All would stay disabled.
        const localeIdsByDocument = new Map(
          documents.map((doc) => {
            const documentId = getDocumentPublishedId(doc);
            const versionId = getVersionId(doc);
            return [
              doc,
              getLocaleIdsToPoll(getTargetLocales(doc), (localeId) =>
                pendingTranslationsRef.current.has(
                  createTranslationStatusKey(
                    branchId,
                    documentId,
                    versionId,
                    localeId
                  )
                )
              ),
            ] as const;
          })
        );

        const fileQueryData: FileProperties[] = [];
        for (const doc of documents) {
          for (const localeId of localeIdsByDocument.get(doc) ?? []) {
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

        if (!refresh.isCurrent()) return;

        // Built here rather than inside an updater: it derives from the
        // response, not from previous state, and a state updater has to stay
        // pure — React may run it more than once.
        const newStatuses = new Map<string, TranslationStatus>();

        for (const doc of documents) {
          for (const localeId of localeIdsByDocument.get(doc) ?? []) {
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
        setIsRefreshing(refresh.finish());
      }
    },
    [
      secrets,
      documents,
      locales,
      branchId,
      getVersionId,
      refreshTracker,
      getTargetLocales,
    ]
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
          // With `allowNonDefaultSourceLocales`, each document is resolved
          // from its own language.
          const sourceLocale = allowNonDefault
            ? getDocumentLanguage(doc)
            : pluginConfig.getSourceLocale();

          // Skip source locale - only process translated documents
          if (localeId === sourceLocale) {
            return { patched: false, doc, localeId, skipped: true };
          }

          // Find the translated document for this locale
          const translatedDoc = await findTranslatedDocumentForLocale(
            doc._id,
            localeId,
            client,
            sourceLocale
          );

          if (!translatedDoc) {
            return { patched: false, doc, localeId, noTranslation: true };
          }

          const resolvedDoc = await resolveRefs(
            translatedDoc,
            localeId,
            client,
            sourceLocale
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

  const handlePublishAllTranslations = useCallback(
    async ({ localeIds = null }: PublishTranslationsOptions = {}) => {
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
          localeIds,
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
    },
    [secrets, documents, client, branchId]
  );

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
      // A poll slower than the interval is still in flight; let it land
      // rather than stacking another request behind it.
      if (refreshTracker.isRefreshing()) return;
      await handleRefreshAll({ silent: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [
    autoRefresh,
    documents.length,
    secrets,
    handleRefreshAll,
    refreshTracker,
  ]);

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
    getTargetLocales,
    excludedLocale,
    documentRole,
    skippedOriginalCount,

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
