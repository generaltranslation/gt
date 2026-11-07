import type {
  UploadSourceFilesData,
  UploadTranslationsData,
} from '@generaltranslation/api';

type WithContent<File> = Omit<File, 'content' | 'upload'> & {
  /** Text, or base64 for binary formats; files over 4MB are uploaded through `createFileUploads`. */
  content: string;
};

type SourceFile = UploadSourceFilesData['body']['data'][number]['source'];

/** A source file to upload. */
export type FileUpload = WithContent<Omit<SourceFile, 'formatMetadata'>> & {
  /** Format-specific metadata; uploaded through `createFileUploads` along with content too large to send inline. */
  formatMetadata?: Extract<
    NonNullable<SourceFile['formatMetadata']>,
    { content: object }
  >['content'];
};

/** A translation of an uploaded source file, in the format it is saved in. */
export type TranslationUpload = WithContent<
  UploadTranslationsData['body']['data'][number]['translations'][number]
>;
