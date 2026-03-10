export type ExtractionResult = {
  /** The data format of the extracted content */
  dataFormat: 'ICU' | 'JSX';
  /** The extracted translatable content */
  source: string;
  /** Metadata about the extraction */
  metadata: ExtractionMetadata;
};

export type ExtractionMetadata = {
  id?: string;
  context?: string;
  maxChars?: number;
  filePaths?: string[];
  /** Groups related static content variants together (for declareStatic/declare_static) */
  staticId?: string;
};
