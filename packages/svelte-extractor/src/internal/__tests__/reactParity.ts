import { transformSync } from '@babel/core';
import presetReact from '@babel/preset-react';
import React from 'react';
import { hashSource } from 'generaltranslation/id';
import type { JsxChildren } from '@generaltranslation/format/types';
import * as ReactComponents from '../../../../react-core/src/components';
import { addGTIdentifier } from '../../../../react-core/src/utils/internal/addGTIdentifier';
import { writeChildrenAsObjects } from '../../../../react-core/src/utils/internal/writeChildrenAsObjects';

/** A user component, so React reports its tag name as `Link`. */
function Link(props: { children?: React.ReactNode }) {
  return props.children ?? null;
}

const scope = {
  h: React.createElement,
  Fragment: React.Fragment,
  T: ReactComponents.T,
  Var: ReactComponents.Var,
  Num: ReactComponents.Num,
  Currency: ReactComponents.Currency,
  DateTime: ReactComponents.DateTime,
  RelativeTime: ReactComponents.RelativeTime,
  Branch: ReactComponents.Branch,
  Plural: ReactComponents.Plural,
  Link,
  name: 'Ada',
  count: 2,
  price: 12,
  date: new Date(0),
  status: 'active',
};

/**
 * Compiles a TSX `<T>` with Babel's JSX transform and serializes it through
 * React's runtime `<T>` pipeline, which is the source of truth for hashes.
 */
export function serializeReactT(tsx: string): {
  source: JsxChildren;
  hash: string;
} {
  const result = transformSync(`(${tsx})`, {
    babelrc: false,
    configFile: false,
    presets: [
      [
        presetReact,
        { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment' },
      ],
    ],
  });
  const code = result?.code?.trim().replace(/;$/, '') ?? '';
  const names = Object.keys(scope);
  const element = new Function(...names, `return ${code};`)(
    ...names.map((key) => scope[key as keyof typeof scope])
  ) as React.ReactElement<{
    children?: React.ReactNode;
    context?: string;
    maxChars?: number;
    requiresReview?: boolean;
  }>;

  const { children, context, maxChars, requiresReview } = element.props;
  const source = writeChildrenAsObjects(addGTIdentifier(children));
  const hash = hashSource({
    source,
    ...(context && { context }),
    ...(maxChars != null && { maxChars: Math.abs(maxChars) }),
    ...(requiresReview === true && { requiresReview: true }),
    dataFormat: 'JSX',
  });
  return { source, hash };
}
