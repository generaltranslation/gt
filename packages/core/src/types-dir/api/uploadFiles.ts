import type {
  OverwriteTranslationsData,
  UploadSourceFilesData,
  UploadTranslationsData,
  UpsertAssetsData,
} from '@generaltranslation/api';

type WithContent<File> = Omit<File, 'content' | 'upload'> & {
  /** Text, or base64 for binary formats; content too large for one request, 4MB, is uploaded and sent by reference. */
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

/** An uploaded source file, named to upload its translations. */
export type TranslationSourceUpload = WithContent<
  UploadTranslationsData['body']['data'][number]['source']
>;

/** A translation of an uploaded source file, in the format it is saved in. */
export type TranslationUpload = WithContent<
  UploadTranslationsData['body']['data'][number]['translations'][number]
>;

/** A translation to overwrite with its full content, as text. */
export type TranslationOverwrite = WithContent<
  OverwriteTranslationsData['body']['translations'][number]
>;

/** An organization asset to upload, with base64 `content`. */
export type AssetUpload = WithContent<
  UpsertAssetsData['body']['assets'][number]
>;
