'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  getStatus,
  start as coreStart,
  stop as coreStop,
  subscribe,
} from './recorderCore';
import type { RecorderBundle, RecorderConfig, RecorderStatus } from '../types';

export type UseRecorder = {
  /** 'idle' | 'recording' | 'preparing' (harvest running after stop). */
  status: RecorderStatus;
  /** Convenience for `status === 'recording'`. */
  isRecording: boolean;
  /** Begin capture. `config.locales` is SOURCE-first. */
  start: (config: RecorderConfig) => void;
  /** Stop capture; resolves after harvest with the assembled bundle. */
  stop: () => Promise<RecorderBundle | null>;
};

/**
 * Control the recorder from anywhere in the tree. Reads the module-level recorder
 * (see recorderCore) so it reflects the true state regardless of where the trigger
 * or <GTRecorder> is mounted, and survives remounts mid-recording.
 */
export function useRecorder(): UseRecorder {
  const [status, setStatus] = useState<RecorderStatus>(() => getStatus());

  useEffect(() => {
    // Sync immediately in case status changed between render and effect, then track.
    setStatus(getStatus());
    return subscribe(setStatus);
  }, []);

  const start = useCallback((config: RecorderConfig) => coreStart(config), []);
  const stop = useCallback(() => coreStop(), []);

  return { status, isRecording: status === 'recording', start, stop };
}
