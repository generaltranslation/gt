import type { JsxChildren } from '@generaltranslation/format/types';

export type RuntimeSeedSource = {
  file: string;
  line: number;
  column: number;
};

export type RuntimeSeedMetadata = {
  context?: string;
  id?: string;
  maxChars?: number;
  requiresReview?: boolean;
};

export type RuntimeSeed = {
  source: RuntimeSeedSource;
  hash: string;
  jsxChildren: JsxChildren;
  metadata?: RuntimeSeedMetadata;
};

export type RuntimeSeedCandidate = {
  schemaVersion: 1;
  input: string;
  seeds: RuntimeSeed[];
};

export type CaptureRuntimeSeedsOptions = {
  cwd?: string;
  file?: string;
  code?: string;
  locale?: string;
};
