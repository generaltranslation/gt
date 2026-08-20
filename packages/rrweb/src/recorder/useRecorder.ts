'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
  getStatus,
  start as coreStart,
  stop as coreStop,
  subscribe,
} from './recorderCore';
import type { RecorderBundle, RecorderConfig, RecorderStatus } from '../types';

// The recorder lives in module state; there is no recording during SSR.
const getServerStatus = (): RecorderStatus => 'idle';

export type UseRecorder = {
  /** 'idle' | 'recording' | 'preparing' (harvest running after stop). */
  status: RecorderStatus;
  /** Convenience for `status === 'recording'`. */
  isRecording: boolean;
  /** Begin capture (embeds fonts before snapshotting). `config.locales` is SOURCE-first. */
  start: (config: RecorderConfig) => Promise<void>;
  /** Stop capture; resolves after harvest with the assembled bundle. */
  stop: () => Promise<RecorderBundle | null>;
};

/**
 * Control the recorder from anywhere in the tree. Reads the module-level recorder
 * (see recorderCore) so it reflects the true state regardless of where the trigger
 * or <GTRecorder> is mounted, and survives remounts mid-recording.
 */
export function useRecorder(): UseRecorder {
  // useSyncExternalStore is purpose-built for subscribing to an external store like
  // our module-level recorder — no manual useEffect/useState, and no tearing.
  const status = useSyncExternalStore(subscribe, getStatus, getServerStatus);

  const start = useCallback(
    (config: RecorderConfig): Promise<void> => coreStart(config),
    []
  );
  const stop = useCallback(() => coreStop(), []);

  return { status, isRecording: status === 'recording', start, stop };
}
