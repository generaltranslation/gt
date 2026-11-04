import type {
  UploadSourceFilesData,
  UploadTranslationsData,
} from '@generaltranslation/api';

type WithContent<File> = Omit<File, 'content' | 'upload'> & {
  /** Text, or base64 for binary formats; files over 4MB are uploaded through `createFileUploads`. */
  content: string;
};

/** A source file to upload. */
export type FileUpload = WithContent<
  UploadSourceFilesData['body']['data'][number]['source']
>;

/** A translation of an uploaded source file, in the format it is saved in. */
export type TranslationUpload = WithContent<
  UploadTranslationsData['body']['data'][number]['translations'][number]
>;
