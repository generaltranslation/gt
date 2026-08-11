import React from 'react';
import { describe, expect, it } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { addGTIdentifier } from '../addGTIdentifier';
import { writeChildrenAsObjects } from '../writeChildrenAsObjects';
import {
  GtInternalRelativeTime,
  RelativeTime,
} from '../../../components/variables/RelativeTime';
import { Num } from '../../../components/variables/Num';
import { getVariableProps } from '../../variables/_getVariableProps';

// What the CLI and compiler emit for this JSX; a runtime mismatch makes a
// published translation unresolvable.
const CLI_RELATIVE_TIME = { i: 1, k: '_gt_time_1', v: 'rt' };
const CLI_NUM = { i: 1, k: '_gt_n_1', v: 'n' };

function runtimeObjects(node: React.ReactNode) {
  return writeChildrenAsObjects(addGTIdentifier(node));
}

describe('relative-time variable identity', () => {
  it('matches the CLI for <Num>', () => {
    expect(runtimeObjects(<Num>{3}</Num>)).toEqual(CLI_NUM);
  });

  it('matches the CLI for <RelativeTime>', () => {
    expect(runtimeObjects(<RelativeTime value={-3} unit='day' />)).toEqual(
      CLI_RELATIVE_TIME
    );
  });

  it('produces the same hash as the CLI for <RelativeTime>', () => {
    const runtime = hashSource({
      source: runtimeObjects(<RelativeTime value={-3} unit='day' />),
      dataFormat: 'JSX',
    });
    const cli = hashSource({ source: CLI_RELATIVE_TIME, dataFormat: 'JSX' });
    expect(runtime).toBe(cli);
  });

  // A key mismatch here renders the variable as undefined, silently.
  it('keys the runtime variable map the way the payload asks for it', () => {
    const tagged = addGTIdentifier(
      <RelativeTime value={-3} unit='day' />
    ) as React.ReactElement<Record<string, unknown>>;
    const props = getVariableProps(
      tagged.props as Parameters<typeof getVariableProps>[0]
    );
    expect(props.variableName).toBe(CLI_RELATIVE_TIME.k);
    expect(props.variableType).toBe(CLI_RELATIVE_TIME.v);
  });

  it('marks the compiler-injected variant as automatic', () => {
    const tagged = addGTIdentifier(
      <GtInternalRelativeTime value={-3} unit='day' />
    ) as { props: { 'data-_gt': { injectionType: string } } };
    expect(tagged.props['data-_gt'].injectionType).toBe('automatic');
  });
});
