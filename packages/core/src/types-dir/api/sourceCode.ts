/**
 * The lines of a source file around a translatable string, sent as translation
 * context: `before` and `after` surround the `target` lines.
 */
export type SourceCode = {
  before: string;
  target: string;
  after: string;
};
