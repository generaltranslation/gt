import type { MoveFilesData } from '@generaltranslation/api';

export type MoveMapping = MoveFilesData['body']['moves'][number];

export type ProcessMovesOptions = {
  timeout?: number;
  branchId?: string;
};
