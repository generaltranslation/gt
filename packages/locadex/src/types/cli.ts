export type CliOptions = {
  verbose?: boolean;
  debug?: boolean;
  noTelemetry?: boolean;
  batchSize?: string;
  concurrency?: string;
};

export type LocadexConfig = {
  batchSize: number;
  maxConcurrency: number;
  matchingFiles: string[];
  matchingExtensions: string[];
};
