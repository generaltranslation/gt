// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

/**
 * Add cleanup function to cancel async tasks
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Stack, Text, Card, Button, Flex, Spinner, Switch } from '@sanity/ui';
import { Tooltip } from '@sanity/ui/tooltip';
import { useToast } from '@sanity/ui/toast';
import { pluginConfig } from '../../adapter/core';
import { SaveLocalTranslationsDialog } from '../page/SaveLocalTranslationsDialog';
import { DebugInfoDialog } from '../page/DebugInfoDialog';
import { version as PACKAGE_VERSION } from '../../../package.json';
import { useTranslations } from '../TranslationsProvider';
import { LanguageStatus } from '../shared/LanguageStatus';
import { resolveLanguageStatusState } from '../../utils/languageStatusState';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import {
  allowsNonDefaultSourceLocales,
  describeUntranslatableRole,
  getDocumentLanguage,
} from '../../utils/translationSource';
import { UNVERIFIED_ROLE_MESSAGE } from '../../utils/documentRoleState';
import { LocaleSelector } from '../shared/LocaleSelector';
import { DownloadIcon } from '@sanity/icons/Download';
import { LinkIcon } from '@sanity/icons/Link';
import { PublishIcon } from '@sanity/icons/Publish';
import { RefreshIcon } from '@sanity/icons/Refresh';
import { TranslateIcon } from '@sanity/icons/Translate';
import { UploadIcon } from '@sanity/icons/Upload';
import {
  createTranslationStatusKey,
  getDocumentPublishedId,
} from '../../utils/documentIds';

export const TranslationView = () => {
  const {
    documents,
    locales,
    translationStatuses,
    pendingTranslations,
    importingTranslations,
    branchId,
    isBusy,
    handleTranslateAll,
    handleUploadExistingTranslations,
    handleImportDocument,
    handleRefreshAll,
    isRefreshing,
    importedTranslations,
    handlePatchDocumentReferences,
    handlePublishAllTranslations,
    autoRefresh,
    setAutoRefresh,
    autoImport,
    setAutoImport,
    autoPatchReferences,
    setAutoPatchReferences,
    autoPublish,
    setAutoPublish,
    preserveExistingTranslations,
    setPreserveExistingTranslations,
    getVersionId,
    documentRole,
  } = useTranslations();

  const [isImporting, setIsImporting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploadingExisting, setIsUploadingExisting] = useState(false);
  const [isSaveLocalDialogOpen, setIsSaveLocalDialogOpen] = useState(false);
  const [isDebugInfoDialogOpen, setIsDebugInfoDialogOpen] = useState(false);

  const toast = useToast();

  // Get the single document (first document in single document mode)
  const document = documents[0];

  // Fixed for the Studio's lifetime.
  const allowNonDefault = allowsNonDefaultSourceLocales();

  // With `allowNonDefaultSourceLocales`, translation tools are shown on the
  // original of a translation group, in whatever language it is written
  // (untagged documents are in the source locale). Without it, they are only
  // shown on documents in the configured source locale.
  const shouldShowTranslationComponents = !document
    ? false
    : allowNonDefault ||
      (document[pluginConfig.getLanguageField()] ||
        pluginConfig.getSourceLocale()) === pluginConfig.getSourceLocale();

  // The locale this document is translated from, never a target.
  const sourceLocale =
    allowNonDefault && document
      ? getDocumentLanguage(document)
      : pluginConfig.getSourceLocale();
  // Local edits are only collected for groups whose original is in the
  // configured source locale. The saved preference is left as it is, since
  // it still applies to those documents.
  const canPreserveLocalEdits = sourceLocale === pluginConfig.getSourceLocale();

  // Get available locales (excluding source locale)
  const availableLocales = useMemo(() => {
    return locales.filter(
      (locale) => locale.enabled !== false && locale.localeId !== sourceLocale
    );
  }, [locales, sourceLocale]);

  // Every configured target locale, regardless of selection. The status
  // section renders this stable list so toggling locale checkboxes doesn't
  // add/remove rows and shift the layout.
  const statusLocales = useMemo(() => {
    return locales.filter((locale) => locale.localeId !== sourceLocale);
  }, [locales, sourceLocale]);

  // Get document ID for status tracking
  const documentId = useMemo(() => {
    if (!document) return null;
    return getDocumentPublishedId(document);
  }, [document]);

  // Version the status entries are keyed under: the _rev pinned at upload
  // time when available, so importing in place (which bumps the live _rev)
  // doesn't detach the UI from the statuses of the uploaded version.
  const versionId = useMemo(() => {
    if (!document) return null;
    return getVersionId(document);
  }, [document, getVersionId]);

  // Translations that were already complete when this dialog opened. Auto-import
  // means "import a translation that finishes while I am watching", so these are
  // left alone: importing them would rewrite translated documents — discarding
  // any edits made to them — every time the dialog is opened. Reset on Translate,
  // so a fresh run's results are imported even for a locale that already had one.
  const alreadyCompleteRef = useRef<Set<string> | null>(null);

  const statusKeyFor = useCallback(
    (localeId: string) =>
      createTranslationStatusKey(
        branchId,
        documentId ?? '',
        versionId ?? '',
        localeId
      ),
    [branchId, documentId, versionId]
  );

  if (
    alreadyCompleteRef.current === null &&
    documentId &&
    versionId &&
    translationStatuses.size > 0
  ) {
    alreadyCompleteRef.current = new Set(
      statusLocales
        .map((locale) => statusKeyFor(locale.localeId))
        .filter((key) => translationStatuses.get(key)?.isReady)
    );
  }

  // The per-locale rows already read "Translating…"; this only guards the
  // button against enqueueing the same run twice.
  const isWaitingOnTranslations = statusLocales.some((locale) =>
    pendingTranslations.has(statusKeyFor(locale.localeId))
  );

  // Unified import functionality
  const handleImportTranslations = useCallback(
    async (options: { autoOnly?: boolean } = {}) => {
      const { autoOnly = false } = options;

      // Check preconditions
      if (isImporting || !documentId || !versionId) return;
      if (autoOnly && !autoImport) return;

      // Find translations ready to import (any configured locale, not just
      // the ones currently selected for translation)
      const readyTranslations = statusLocales.filter((locale) => {
        const key = createTranslationStatusKey(
          branchId,
          documentId,
          versionId,
          locale.localeId
        );
        const status = translationStatuses.get(key);
        if (!status?.isReady || importedTranslations.has(key)) return false;
        return !(autoOnly && alreadyCompleteRef.current?.has(key));
      });

      if (readyTranslations.length === 0) return;

      setIsImporting(true);
      try {
        // Import sequentially: internationalized-array imports patch this same
        // document in place, so concurrent locale imports would overwrite each
        // other and only the last locale would survive.
        for (const locale of readyTranslations) {
          await handleImportDocument(documentId, versionId, locale.localeId);
        }

        // Auto patch document references if enabled
        if (autoPatchReferences) {
          await handlePatchDocumentReferences();
        }

        // Auto publish translations if enabled
        if (autoPublish) {
          await handlePublishAllTranslations();
        }
      } finally {
        setIsImporting(false);
      }
    },
    [
      autoImport,
      isImporting,
      documentId,
      versionId,
      statusLocales,
      translationStatuses,
      importedTranslations,
      handleImportDocument,
      autoPatchReferences,
      handlePatchDocumentReferences,
      autoPublish,
      handlePublishAllTranslations,
      toast,
    ]
  );

  // Check for completed translations on status updates (auto-import)
  useEffect(() => {
    handleImportTranslations({ autoOnly: true });
  }, [handleImportTranslations]);

  if (!shouldShowTranslationComponents) {
    return (
      <Card padding={4} tone='neutral' border>
        <Text size={1} muted>
          Translation tools are only available for{' '}
          <code>{pluginConfig.getSourceLocale()}</code> documents.
        </Text>
      </Card>
    );
  }
  // The role is only looked up with `allowNonDefaultSourceLocales`.
  if (
    allowNonDefault &&
    (!documentRole || documentRole.status === 'resolving')
  ) {
    return (
      <Flex align='center' justify='center' padding={4}>
        <Spinner />
      </Flex>
    );
  }
  const unavailableMessage =
    !allowNonDefault || !documentRole || documentRole.status === 'resolving'
      ? null
      : documentRole.status === 'unverified'
        ? UNVERIFIED_ROLE_MESSAGE
        : documentRole.role.kind !== 'original'
          ? createDiagnosticMessage(
              describeUntranslatableRole(documentRole.role)
            )
          : null;
  if (unavailableMessage) {
    return (
      <Card padding={4} tone='neutral' border>
        <Text size={1} muted>
          {unavailableMessage}
        </Text>
      </Card>
    );
  }

  return (
    <Stack gap={6} padding={4}>
      {/* Translate Section */}
      <Stack gap={4}>
        <Text as='h2' weight='semibold' size={2}>
          Translate
        </Text>

        <LocaleSelector />

        <Button
          onClick={() => {
            // A new run's results should import even for locales that already
            // had a translation when the dialog opened.
            alreadyCompleteRef.current = new Set();
            handleTranslateAll();
          }}
          disabled={
            isBusy || isWaitingOnTranslations || !availableLocales.length
          }
          icon={TranslateIcon}
          text={isWaitingOnTranslations ? 'Translating…' : 'Translate'}
          loading={(isBusy && !isUploadingExisting) || isWaitingOnTranslations}
        />
      </Stack>

      <SaveLocalTranslationsDialog
        isOpen={isSaveLocalDialogOpen}
        onClose={() => setIsSaveLocalDialogOpen(false)}
        onConfirm={() => {
          setPreserveExistingTranslations(true);
          setIsSaveLocalDialogOpen(false);
        }}
      />

      {/* Translation Status Section */}
      {documentId && versionId && statusLocales.length > 0 && (
        <Stack gap={4}>
          <Flex align='center' justify='space-between'>
            <Text as='h2' weight='semibold' size={2}>
              Translation Status
            </Text>
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
                mode='ghost'
                icon={RefreshIcon}
                text='Refresh'
                loading={isRefreshing}
                onClick={() => handleRefreshAll()}
                disabled={isRefreshing || isBusy}
              />
            </Flex>
          </Flex>

          <Card border radius={3} paddingY={1}>
            {statusLocales.map((locale) => {
              const key = createTranslationStatusKey(
                branchId,
                documentId,
                versionId,
                locale.localeId
              );
              const status = translationStatuses.get(key);
              const isImported = importedTranslations.has(key);

              return (
                <LanguageStatus
                  key={key}
                  localeId={locale.localeId}
                  state={resolveLanguageStatusState({
                    status,
                    isImported,
                    isPending: pendingTranslations.has(key),
                  })}
                  isImporting={importingTranslations.has(key)}
                  importFile={async () => {
                    if (!isImported && status?.isReady) {
                      await handleImportDocument(
                        documentId,
                        versionId,
                        locale.localeId
                      );
                    }
                  }}
                />
              );
            })}
          </Card>

          {/* Import Controls */}
          <Stack gap={3}>
            <Flex gap={2} align='center' justify='flex-start'>
              <Button
                mode='ghost'
                onClick={async () => {
                  setIsUploadingExisting(true);
                  try {
                    await handleUploadExistingTranslations();
                  } finally {
                    setIsUploadingExisting(false);
                  }
                }}
                disabled={
                  isBusy || !availableLocales.length || !canPreserveLocalEdits
                }
                icon={UploadIcon}
                text='Save Local Edits'
                loading={isUploadingExisting}
                style={{ minWidth: '180px' }}
              />
              <Flex gap={2} align='center'>
                <Switch
                  checked={
                    canPreserveLocalEdits && preserveExistingTranslations
                  }
                  disabled={!canPreserveLocalEdits}
                  onChange={() => {
                    if (!canPreserveLocalEdits) return;
                    // Turning it on changes what wins on a conflict, so explain
                    // before enabling; turning it off is safe.
                    if (preserveExistingTranslations) {
                      setPreserveExistingTranslations(false);
                    } else {
                      setIsSaveLocalDialogOpen(true);
                    }
                  }}
                />
                <Text size={1}>Save local edits before translating</Text>
              </Flex>
            </Flex>
            {!canPreserveLocalEdits && (
              <Text size={1} muted>
                Local edits can only be saved for translations of{' '}
                {pluginConfig.getSourceLocale()} documents. Edits to
                translations of this {sourceLocale} document are replaced when
                they are imported.
              </Text>
            )}
            <Flex gap={3} align='center' justify='space-between'>
              <Flex gap={2} align='center'>
                <Button
                  mode='ghost'
                  onClick={() => handleImportTranslations()}
                  text='Import All'
                  loading={isImporting}
                  icon={DownloadIcon}
                  disabled={
                    isImporting ||
                    statusLocales.every((locale) => {
                      const key = createTranslationStatusKey(
                        branchId,
                        documentId,
                        versionId,
                        locale.localeId
                      );
                      const status = translationStatuses.get(key);
                      return !status?.isReady || importedTranslations.has(key);
                    })
                  }
                  style={{ minWidth: '180px' }}
                />
                <Flex gap={2} align='center'>
                  <Switch
                    checked={autoImport}
                    onChange={() => setAutoImport(!autoImport)}
                    disabled={isImporting}
                  />
                  <Text size={1}>Auto-import when complete</Text>
                </Flex>
              </Flex>
              {/* Counted against every configured locale. The number of
                  currently-ready translations decays to zero as they are
                  imported, because a downloaded file drops out of the status
                  query — which made the old denominator read "6/0". */}
              <Text size={1} muted>
                {
                  statusLocales.filter((locale) =>
                    importedTranslations.has(statusKeyFor(locale.localeId))
                  ).length
                }{' '}
                of {statusLocales.length} imported
              </Text>
            </Flex>

            <Flex gap={2} align='center' justify='flex-start'>
              <Tooltip
                placement='top'
                content={`Replaces references to ${sourceLocale} documents in this document with the corresponding translated document reference`}
              >
                <Button
                  mode='ghost'
                  onClick={async () => {
                    await handlePatchDocumentReferences();
                  }}
                  text='Patch References'
                  loading={isBusy}
                  icon={LinkIcon}
                  disabled={isBusy || isImporting}
                  style={{ minWidth: '180px' }}
                />
              </Tooltip>
              <Flex gap={2} align='center'>
                <Switch
                  checked={autoPatchReferences}
                  onChange={() => setAutoPatchReferences(!autoPatchReferences)}
                  disabled={isImporting || isBusy}
                />
                <Text size={1}>Auto-patch after import</Text>
              </Flex>
            </Flex>

            <Flex gap={2} align='center' justify='flex-start'>
              <Tooltip
                placement='top'
                content='Publishes all translations (if the source document is published)'
              >
                <Button
                  mode='ghost'
                  onClick={async () => {
                    setIsPublishing(true);
                    try {
                      await handlePublishAllTranslations();
                    } finally {
                      setIsPublishing(false);
                    }
                  }}
                  text='Publish Translations'
                  loading={isPublishing}
                  icon={PublishIcon}
                  disabled={isBusy || isPublishing || isImporting}
                  style={{ minWidth: '180px' }}
                />
              </Tooltip>
              <Flex gap={2} align='center'>
                <Switch
                  checked={autoPublish}
                  onChange={() => setAutoPublish(!autoPublish)}
                  disabled={isPublishing || isImporting || isBusy}
                />
                <Text size={1}>Auto-publish after import</Text>
              </Flex>
            </Flex>
          </Stack>
        </Stack>
      )}

      <Card borderTop paddingTop={3}>
        <Flex align='center' justify='flex-end' gap={2}>
          <Text size={1} muted>
            gt-sanity v{PACKAGE_VERSION}
          </Text>
          <Button
            fontSize={1}
            padding={2}
            mode='bleed'
            text='Debug info'
            onClick={() => setIsDebugInfoDialogOpen(true)}
          />
        </Flex>
      </Card>

      <DebugInfoDialog
        isOpen={isDebugInfoDialogOpen}
        onClose={() => setIsDebugInfoDialogOpen(false)}
      />
    </Stack>
  );
};
