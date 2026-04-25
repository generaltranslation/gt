import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  dynamicTranslationError,
  createGenericRuntimeTranslationError,
  runtimeTranslationTimeoutWarning,
} from '../../errors-dir/createErrors';
import {
  RenderMethod,
  TranslatedChildren,
  Translations,
} from '../../types-dir/types';
import {
  TranslateIcuCallback,
  TranslateChildrenCallback,
} from '../../types-dir/runtime';
import { JsxChildren } from 'generaltranslation/internal';
import {
  maxConcurrentRequests,
  maxBatchSize,
  batchInterval,
} from '../config/defaultProps';
import { GT } from 'generaltranslation';
import type { TranslateManyEntry } from 'generaltranslation/types';
import { BatchingQueue } from 'gt-i18n/internal';

type TranslationRequestMetadata = {
  hash: string;
  context?: string;
  maxChars?: number;
  [attr: string]: any;
};

type QueueItem =
  | {
      dataFormat: 'ICU';
      source: string;
      metadata: TranslationRequestMetadata;
    }
  | {
      dataFormat: 'JSX';
      source: JsxChildren;
      metadata: TranslationRequestMetadata;
    };

export default function useRuntimeTranslation({
  gt,
  locale,
  versionId, // kept for API compatibility (not used)
  defaultLocale,
  runtimeUrl,
  renderSettings,
  setTranslations,
  environment,
  ...additionalMetadata
}: {
  gt: GT;
  locale: string;
  versionId?: string;
  defaultLocale?: string;
  runtimeUrl?: string | null;
  renderSettings: {
    method: RenderMethod;
    timeout?: number;
  };
  environment: 'development' | 'production' | 'test';
  setTranslations: React.Dispatch<React.SetStateAction<Translations | null>>;
  [key: string]: any;
}): {
  registerIcuForTranslation: TranslateIcuCallback;
  registerJsxForTranslation: TranslateChildrenCallback;
  developmentApiEnabled: boolean;
} {
  // ------ EARLY RETURN IF DISABLED ----- //
  const developmentApiEnabled =
    !!gt.projectId &&
    !!runtimeUrl &&
    !!gt.devApiKey &&
    environment === 'development';

  if (!developmentApiEnabled) {
    const disabledError = (fn: string) =>
      Promise.reject(
        new Error(`${fn}() failed because translation is disabled`)
      );
    return {
      developmentApiEnabled,
      registerIcuForTranslation: () =>
        disabledError('registerIcuForTranslation'),
      registerJsxForTranslation: () =>
        disabledError('registerJsxForTranslation'),
    };
  }

  // ---------- CONFIG SNAPSHOT (stable via ref, updated each render) ---------- //
  const cfgRef = useRef({
    gt,
    locale,
    baseMetadata: {
      ...additionalMetadata,
      projectId: gt.projectId,
      sourceLocale: defaultLocale,
    },
    timeout: renderSettings.timeout,
  });
  cfgRef.current.gt = gt;
  cfgRef.current.locale = locale;
  cfgRef.current.baseMetadata = {
    ...additionalMetadata,
    projectId: gt.projectId,
    sourceLocale: defaultLocale,
  };
  cfgRef.current.timeout = renderSettings.timeout;

  // ---------- LIFECYCLE & STAGING (avoid setState before mount) ---------- //
  const mountedRef = useRef(false);
  const stagedResultsRef = useRef<Translations | null>(null);
  const [flushTick, setFlushTick] = useState(0);

  const mergeIntoTranslations = useCallback(
    (delta: Translations) => {
      setTranslations((prev) => {
        const keys = Object.keys(delta);
        if (keys.length === 0) return prev;
        const next = prev ? { ...prev } : {};
        let changed = false;
        for (const k of keys) {
          const nv = (delta as any)[k];
          const pv = (prev as any)?.[k];
          if (!Object.is(pv, nv)) {
            (next as any)[k] = nv;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    [setTranslations]
  );

  const stageAndRequestFlush = useCallback((delta: Translations) => {
    stagedResultsRef.current = {
      ...(stagedResultsRef.current ?? {}),
      ...delta,
    };
    // Only trigger a state change after mount; before mount, we'll flush on mount.
    if (mountedRef.current) setFlushTick((t) => t + 1);
  }, []);

  // Mount/unmount: mark mounted and flush anything staged pre-mount.
  useEffect(() => {
    mountedRef.current = true;
    if (stagedResultsRef.current) {
      const staged = stagedResultsRef.current;
      stagedResultsRef.current = null;
      mergeIntoTranslations(staged);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [mergeIntoTranslations]);

  // Perform the actual setTranslations in an effect (runs post-commit).
  useEffect(() => {
    if (!mountedRef.current) return;
    const staged = stagedResultsRef.current;
    if (staged) {
      stagedResultsRef.current = null;
      mergeIntoTranslations(staged);
    }
  }, [flushTick, mergeIntoTranslations]);

  // ---------- DEDUP MAP (separate from queue: same key can map to one in-flight Promise) ---------- //
  const pendingRequestsRef = useRef<Map<string, Promise<TranslatedChildren>>>(
    new Map()
  );

  // ---------- BATCHING QUEUE ---------- //
  // Lazy-init via useState so the queue is constructed once. The sendBatch
  // closure captures cfgRef (mutable, always current) and stageAndRequestFlush
  // (stable useCallback identity), so it stays valid across renders.
  const [queue] = useState(
    () =>
      new BatchingQueue<QueueItem, TranslatedChildren | null>({
        maxBatchSize,
        batchInterval,
        maxConcurrent: maxConcurrentRequests,
        sendBatch: async (entries) => {
          const { gt, locale, baseMetadata, timeout } = cfgRef.current;

          const requestsRecord: Record<string, TranslateManyEntry> = {};
          for (const e of entries) {
            requestsRecord[e.item.metadata.hash] = {
              source: e.item.source,
              metadata: { ...e.item.metadata, dataFormat: e.item.dataFormat },
            };
          }

          const newTranslations: Translations = {};
          try {
            const results = await gt.translateMany(
              requestsRecord,
              { ...baseMetadata, targetLocale: locale },
              timeout
            );
            for (const e of entries) {
              const { hash, id } = e.item.metadata;
              const result = results[hash];
              if (result && result.success) {
                const value = result.translation;
                newTranslations[hash] = value;
                e.resolve(value);
              } else {
                const msg = createGenericRuntimeTranslationError(id, hash);
                console.warn(
                  result?.error
                    ? `${msg} ${result.error}`
                    : `${msg} Unknown response format.`,
                  result?.error ? undefined : result
                );
                newTranslations[hash] = null;
                e.resolve(null);
              }
            }
          } catch (err: any) {
            if (err?.name === 'AbortError') {
              console.warn(runtimeTranslationTimeoutWarning);
            } else {
              console.warn(dynamicTranslationError, err);
            }
            // Never reject — preserve the original "always resolve, null on failure" contract.
            for (const e of entries) {
              newTranslations[e.item.metadata.hash] = null;
              e.resolve(null);
            }
          }

          stageAndRequestFlush(newTranslations);
        },
      })
  );

  // ---------- REGISTRATION (returns Promises for Suspense) ---------- //
  const createRegistration = useCallback(
    <T extends 'ICU' | 'JSX'>(dataFormat: T) =>
      (params: {
        source: T extends 'ICU' ? string : JsxChildren | undefined;
        targetLocale: string;
        metadata: TranslationRequestMetadata;
      }): Promise<TranslatedChildren> => {
        const key = `${params.metadata.hash}:${params.targetLocale}`;

        const existing = pendingRequestsRef.current.get(key);
        if (existing) return existing;

        const metadata = {
          ...params.metadata,
          ...(params.metadata.maxChars != null && {
            maxChars: Math.abs(params.metadata.maxChars),
          }),
        };

        const item: QueueItem =
          dataFormat === 'JSX'
            ? {
                dataFormat: 'JSX',
                source: params.source as JsxChildren,
                metadata,
              }
            : {
                dataFormat: 'ICU',
                source: params.source as string,
                metadata,
              };

        const p = queue
          .enqueue(item)
          .then((value) => value as TranslatedChildren)
          .finally(() => {
            pendingRequestsRef.current.delete(key);
          });

        pendingRequestsRef.current.set(key, p);
        return p;
      },
    [queue]
  );

  const registerIcuForTranslation = useMemo(
    () => createRegistration('ICU'),
    [createRegistration]
  );
  const registerJsxForTranslation = useMemo(
    () => createRegistration('JSX'),
    [createRegistration]
  );

  return {
    developmentApiEnabled,
    registerIcuForTranslation,
    registerJsxForTranslation,
  };
}
