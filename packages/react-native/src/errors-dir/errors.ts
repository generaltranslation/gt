import { PACKAGE_NAME } from './constants';
export const failedToReadConfigFileError = (filePath: string) =>
  `${PACKAGE_NAME} Error: Failed to read GT Config at ${filePath}.`;
