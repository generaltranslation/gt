export type CliOptions = {
  verbose?: boolean;
  debug?: boolean;
  noTelemetry?: boolean;
  batchSize?: string;
  concurrency?: string;
  matchingFiles?: string[];
  appDir: string;
  timeout?: string;
  noTranslate?: boolean;
  formatCmd?: string;
};

export type LocadexConfig = {
  batchSize: number;
  maxConcurrency: number;
  matchingFiles: string[];
  timeout: number;
};
