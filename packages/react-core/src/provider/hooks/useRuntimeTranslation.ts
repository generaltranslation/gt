import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  dynamicTranslationError,
  createGenericRuntimeTranslationError,
  runtimeTranslationTimeoutWarning,
} from '../../errors/createErrors';
import {
  RenderMethod,
  TranslatedChildren,
  Translations,
} from '../../types/types';
import {
  TranslateIcuCallback,
  TranslateChildrenCallback,
} from '../../types/runtime';
import { JsxChildren } from 'generaltranslation/internal';
import {
  maxConcurrentRequests,
  maxBatchSize,
  batchInterval,
} from '../config/defaultProps';
import { GT } from 'generaltranslation';

type TranslationRequestMetadata = {
  hash: string;
  context?: string;
  [attr: string]: any;
};

type TranslationRequestQueueItem =
  | {
      dataFormat: 'ICU';
      source: string;
      metadata: TranslationRequestMetadata;
      resolve: (value: TranslatedChildren) => void;
      reject: (error: any) => void; // kept for API compatibility (unused after change)
    }
  | {
      dataFormat: 'JSX';
      source: JsxChildren;
      metadata: TranslationRequestMetadata;
      resolve: (value: TranslatedChildren) => void;
      reject: (error: any) => void; // kept for API compatibility (unused after change)
    };

export default function useRuntimeTranslation({
  gt,
  locale,
  versionId, // kept for API compatibility (not used)
  defaultLocale,
  runtimeUrl,
  renderSettings,
  setTranslations,
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
    process.env.NODE_ENV === 'development';

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

  // ---------- REQUEST/QUEUE STATE ---------- //
  const activeRequestsRef = useRef(0);
  const requestQueueRef = useRef<Map<string, TranslationRequestQueueItem>>(
    new Map()
  );
  const pendingRequestQueueRef = useRef<
    Map<string, Promise<TranslatedChildren>>
  >(new Map());

  // ---------- BATCH SENDER (no state writes here) ---------- //
  const sendBatchRequest = useCallback(
    async (
      batch: Map<string, TranslationRequestQueueItem>
    ): Promise<Translations> => {
      if (batch.size === 0) return {};
      activeRequestsRef.current += 1;

      const { gt, locale, baseMetadata, timeout } = cfgRef.current;
      const requests = Array.from(batch.values());
      const newTranslations: Translations = {};
      const resultsMap = new Map<string, TranslatedChildren | null>();

      try {
        const results = await gt.translateMany(requests, {
          ...baseMetadata,
          targetLocale: locale,
          timeout,
        });

        results.forEach((result, index) => {
          const req = requests[index];
          const { hash, id } = req.metadata;
          if ('translation' in result) {
            const value = result.translation;
            newTranslations[hash] = value;
            resultsMap.set(hash, value);
          } else if ('error' in result) {
            const msg = createGenericRuntimeTranslationError(id, hash);
            console.warn(
              `${msg} ${result.error || 'An upstream error occurred.'}`
            );
            newTranslations[hash] = null;
            resultsMap.set(hash, null);
          } else {
            const msg = createGenericRuntimeTranslationError(id, hash);
            console.warn(`${msg} Unknown response format.`, result);
            newTranslations[hash] = null;
            resultsMap.set(hash, null);
          }
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          console.warn(runtimeTranslationTimeoutWarning);
        } else {
          console.warn(dynamicTranslationError, e);
        }
        // Mark every request in this batch as null, and warn.
        requests.forEach((r) => {
          newTranslations[r.metadata.hash] = null;
          resultsMap.set(r.metadata.hash, null);
        });
      } finally {
        activeRequestsRef.current -= 1;
        // Resolve the promises for this batch (never reject).
        requests.forEach((r) => {
          const res = resultsMap.get(r.metadata.hash);
          if (res === undefined) {
            console.warn(
              `No translation result for ${r.metadata.hash}; resolving as null.`
            );
            r.resolve(null as unknown as TranslatedChildren);
          } else {
            r.resolve(res as TranslatedChildren);
          }
        });
      }

      return newTranslations;
    },
    []
  );

  // ---------- TIMER-DRIVEN FLUSHER (no polling effect) ---------- //
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<() => Promise<void>>(async () => {});

  const stageAndScheduleNext = useCallback(
    (batchResult: Translations) => {
      // Stage results and request the commit effect to run
      stageAndRequestFlush(batchResult);

      // If more work remains, schedule another flush cycle
      if (requestQueueRef.current.size > 0) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          void tickRef.current();
        }, batchInterval);
      }
    },
    [stageAndRequestFlush]
  );

  const installTick = useCallback(() => {
    tickRef.current = async () => {
      // Respect concurrency cap
      if (activeRequestsRef.current >= maxConcurrentRequests) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          void tickRef.current();
        }, batchInterval);
        return;
      }

      const q = requestQueueRef.current;
      if (q.size === 0) return;

      const batchEntries = Array.from(q.entries()).slice(
        0,
        Math.min(maxBatchSize, q.size)
      );
      const batch = new Map(batchEntries);
      batchEntries.forEach(([k]) => q.delete(k));

      const batchResult = await sendBatchRequest(batch);
      stageAndScheduleNext(batchResult);
    };
  }, [sendBatchRequest, stageAndScheduleNext]);

  const scheduleFlush = useCallback(
    (immediate = false) => {
      installTick();
      if (immediate) {
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        void tickRef.current(); // Safe pre-mount: will only stage results
        return;
      }
      if (flushTimerRef.current) return; // already armed
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        void tickRef.current();
      }, batchInterval);
    },
    [installTick]
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

        const existing = pendingRequestQueueRef.current.get(key);
        if (existing) return existing;

        const p = new Promise<TranslatedChildren>((resolve /*, reject */) => {
          const item: TranslationRequestQueueItem =
            dataFormat === 'JSX'
              ? {
                  dataFormat: 'JSX',
                  source: params.source as JsxChildren,
                  metadata: params.metadata,
                  resolve,
                  reject: () => {}, // no-op; we no longer reject
                }
              : {
                  dataFormat: 'ICU',
                  source: params.source as string,
                  metadata: params.metadata,
                  resolve,
                  reject: () => {}, // no-op; we no longer reject
                };

          requestQueueRef.current.set(key, item);

          const canFlushNow =
            requestQueueRef.current.size >= maxBatchSize &&
            activeRequestsRef.current < maxConcurrentRequests;

          // Kick the scheduler; immediate is safe (no state writes pre-mount)
          scheduleFlush(canFlushNow);
        }).finally(() => {
          pendingRequestQueueRef.current.delete(key);
        });

        pendingRequestQueueRef.current.set(key, p);
        return p;
      },
    [scheduleFlush]
  );

  const registerIcuForTranslation = useMemo(
    () => createRegistration('ICU'),
    [createRegistration]
  );
  const registerJsxForTranslation = useMemo(
    () => createRegistration('JSX'),
    [createRegistration]
  );

  // Cleanup any stray timer on unmount (does not drive batching)
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  return {
    developmentApiEnabled,
    registerIcuForTranslation,
    registerJsxForTranslation,
  };
}
