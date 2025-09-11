import { DataFormat } from './content';
import { FileFormat } from './file';

export type UploadFilesForTranslationOptions = {
    sourceLocale: string;
    targetLocales: string[];
    publish?: boolean;
    requireApproval?: boolean;
    modelProvider?: string;
    force?: boolean;
    timeout?: number;
  };
  
  export type UploadedFileRef = {
    fileId: string;
    versionId: string;
    fileName: string;
    fileFormat: FileFormat;
    dataFormat?: DataFormat;
  };
  
  export type UploadFilesForTranslationResult = {
    shouldGenerateContext: boolean;
    uploadedFiles: UploadedFileRef[];
  };