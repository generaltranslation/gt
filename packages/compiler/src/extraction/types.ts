import type * as t from '@babel/types';

export type ExtractionMode = 'local-expression' | 'local-file' | 'project';

export type ExtractionDiagnostic = {
  level: 'error' | 'warning';
  code: string;
  message: string;
  file?: string;
  loc?: { line?: number; column?: number };
};

export type ExtractionResult<T> = {
  value: T | null;
  diagnostics: ExtractionDiagnostic[];
  dependencies: string[];
};

export type ExtractorHost = {
  readFile(file: string): string | null;
  resolveImport(fromFile: string, specifier: string): string | null;
};

export type ExtractorOptions = {
  mode: ExtractionMode;
  autoderive?: { jsx?: boolean; strings?: boolean };
};

export type ExtractStringExpressionParams = {
  path: import('@babel/traverse').NodePath<t.Expression>;
};

export type Extractor = {
  evaluateStringExpression(
    params: ExtractStringExpressionParams
  ): ExtractionResult<StringExpressionNode>;
};

export type StringExpressionNode =
  | StringStaticNode
  | StringDynamicNode
  | StringDeriveNode
  | StringSequenceNode
  | StringChoiceNode;

export type StringStaticNode = {
  type: 'static';
  value: string;
};

export type StringDynamicNode = {
  type: 'dynamic';
  node: t.Expression;
};

export type StringDeriveNode = {
  type: 'derive';
  node: t.Expression;
};

export type StringSequenceNode = {
  type: 'sequence';
  nodes: StringExpressionNode[];
};

export type StringChoiceNode = {
  type: 'choice';
  branches: StringExpressionNode[];
};
