import type {
  ProcessFileMovesData,
  ProcessFileMovesResponse,
} from '@generaltranslation/api';

export type MoveMapping = ProcessFileMovesData['body']['moves'][number];

export type MoveResult = ProcessFileMovesResponse['results'][number];

// Compatibility response: the published API guarantees summary while the
// generated wire response marks it optional.
export type ProcessMovesResponse = {
  results: MoveResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
};

export type ProcessMovesOptions = {
  timeout?: number;
  branchId?: string;
};
