export type MoveMapping =
  import('@generaltranslation/api').ProcessFileMovesData['body']['moves'][number];

export type MoveResult =
  import('@generaltranslation/api').ProcessFileMovesResponse['results'][number];

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
