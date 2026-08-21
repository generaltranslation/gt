'use client';

import { useEffect } from 'react';

import { RecordingOverlay } from './RecordingOverlay';
import { useRecorder } from './useRecorder';
import {
  abort,
  configure,
  start as coreStart,
  stop as coreStop,
} from './recorderCore';
import { aspectOf } from '../types';
import type { FrameOption, HarvestOptions, RecorderBundle } from '../types';

export type GTRecorderProps = {
  /** Gate: when false, nothing is wired and nothing renders. */
  enabled?: boolean;
  /** CSS selector for the content region to frame + harvest. */
  contentSelector?: string;
  /** Capture framing (see FrameOption). Defaults to no framing. */
  frame?: FrameOption;
  /** Attach a `window.<name>` handle ({ start, stop }) for automated drivers. Off by default. */
  expose?: string | false;
  /** Called with the finished bundle after every stop (button / overlay / automation). */
  onComplete?: (bundle: RecorderBundle) => void;
  /** Harvest options forwarded to harvestLocales. */
  harvest?: HarvestOptions;
  /** Overlay label overrides. */
  labels?: { rec?: string; stop?: string };
};

/**
 * Mount once (e.g. at the app root, inside <GTProvider>). Renders nothing until
 * recording, then the capture overlay. Owns capture config; drive it from anywhere
 * with useRecorder().
 */
export function GTRecorder({
  enabled = true,
  contentSelector,
  frame = 'none',
  expose = false,
  onComplete,
  harvest,
  labels,
}: GTRecorderProps) {
  const { isRecording, stop } = useRecorder();

  useEffect(() => {
    if (!enabled) return;

    configure({
      ...(contentSelector ? { contentSelector } : {}),
      frame,
      onComplete,
      harvest,
    });

    // Optional global handle for headless/automated drivers.
    const w = window as unknown as Record<string, unknown>;
    if (expose) w[expose] = { start: coreStart, stop: coreStop };

    // A refresh/close ends the in-memory recording; just stop rrweb cleanly.
    const onBeforeUnload = () => abort();
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (
        expose &&
        w[expose] &&
        (w[expose] as { start?: unknown }).start === coreStart
      ) {
        delete w[expose];
      }
    };
  }, [enabled, contentSelector, frame, onComplete, harvest, expose]);

  if (!enabled || !isRecording) return null;
  return (
    <RecordingOverlay onStop={stop} aspect={aspectOf(frame)} labels={labels} />
  );
}
