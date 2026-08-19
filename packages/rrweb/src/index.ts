'use client';

export { GTRecorder } from './recorder/GTRecorder';
export type { GTRecorderProps } from './recorder/GTRecorder';
export { RecordingOverlay } from './recorder/RecordingOverlay';
export type { RecordingOverlayProps } from './recorder/RecordingOverlay';
export { useRecorder } from './recorder/useRecorder';
export type { UseRecorder } from './recorder/useRecorder';

export {
  GT_EVENT,
  DEFAULT_CONTENT_SELECTOR,
  type RecorderConfig,
  type RecorderBundle,
  type RecorderStatus,
  type FrameOption,
  type HarvestOptions,
  type LocaleTextOverlay,
  type TranslationsLoader,
} from './types';
