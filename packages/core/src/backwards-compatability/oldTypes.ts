export type OldBranchType = 'branch' | 'plural';

export type OldGTProp = {
  id: number;
  transformation?: OldBranchType;
  branches?: Record<string, OldJsxChildren>;
};

export type OldJsxElement = {
  type: string;
  props: {
    children?: OldJsxChildren;
    'data-_gt': OldGTProp;
  };
};

export type OldVariableType = 'number' | 'variable' | 'datetime' | 'currency';

export type OldVariableObject = {
  variable?: OldVariableType;
  key: string;
  id?: number;
};

export type OldJsxChild = OldJsxElement | OldVariableObject | string;

export type OldJsxChildren = OldJsxChild | OldJsxChild[];
