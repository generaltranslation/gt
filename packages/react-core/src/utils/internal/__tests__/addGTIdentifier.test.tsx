import { isValidElement, type ReactNode } from 'react';
import { hashSource } from 'generaltranslation/id';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { describe, expect, it, onTestFinished } from 'vitest';
import { GtInternalBranch } from '../../../components/branches/Branch';
import { GtInternalPlural, Plural } from '../../../components/branches/Plural';
import { GtInternalTranslateJsx, T } from '../../../components/translation/T';
import { GtInternalNum, Num } from '../../../components/variables/Num';
import {
  GtInternalRelativeTime,
  RelativeTime,
} from '../../../components/variables/RelativeTime';
import { renderDefaultChildren } from '../../rendering/renderPipeline';
import type { GTTag, TaggedElement } from '../../types';
import { getVariableProps } from '../../variables/_getVariableProps';
import { addGTIdentifier } from '../addGTIdentifier';
import { writeChildrenAsObjects } from '../writeChildrenAsObjects';

function getTag(children: ReactNode): GTTag {
  return (addGTIdentifier(children) as TaggedElement).props['data-_gt'];
}

describe('addGTIdentifier variable tags', () => {
  it('tags a manual Num as a number variable', () => {
    expect(getTag(<Num>{3}</Num>)).toMatchObject({
      id: 1,
      injectionType: 'manual',
      transformation: 'variable',
      variableType: 'number',
    });
  });

  it('tags a compiler-inserted Num as automatic', () => {
    expect(getTag(<GtInternalNum>{3}</GtInternalNum>)).toMatchObject({
      injectionType: 'automatic',
      variableType: 'number',
    });
  });

  it('tags RelativeTime with the relative-time variable type', () => {
    expect(getTag(<RelativeTime value={-1} unit='day' />)).toMatchObject({
      injectionType: 'manual',
      transformation: 'variable',
      variableType: 'relative-time',
    });
  });

  it('serializes RelativeTime with the rt type and time variable name', () => {
    expect(
      writeChildrenAsObjects(
        addGTIdentifier(<RelativeTime value={-1} unit='day' />)
      )
    ).toEqual({ i: 1, k: '_gt_time_1', v: 'rt' });
  });

  it('tags a compiler-inserted RelativeTime as automatic', () => {
    expect(
      getTag(<GtInternalRelativeTime value={-1} unit='day' />)
    ).toMatchObject({
      injectionType: 'automatic',
      transformation: 'variable',
      variableType: 'relative-time',
    });
  });

  it('ignores a component whose _gtt is a string', () => {
    function Legacy() {
      return null;
    }
    Object.assign(Legacy, { _gtt: 'variable-number-automatic' });

    expect(getTag(<Legacy />)).toEqual({ id: 1, injectionType: 'manual' });
  });
});

describe('addGTIdentifier RelativeTime matches the CLI', () => {
  const CLI_RELATIVE_TIME = { i: 1, k: '_gt_time_1', v: 'rt' };

  it('produces the same hash as the CLI', () => {
    const runtime = hashSource({
      source: writeChildrenAsObjects(
        addGTIdentifier(<RelativeTime value={-3} unit='day' />)
      ),
      dataFormat: 'JSX',
    });
    const cli = hashSource({ source: CLI_RELATIVE_TIME, dataFormat: 'JSX' });

    expect(runtime).toBe(cli);
  });

  it('keys the variable the way the translation payload asks for it', () => {
    const tagged = addGTIdentifier(
      <RelativeTime value={-3} unit='day' />
    ) as TaggedElement;
    const props = getVariableProps(
      tagged.props as Parameters<typeof getVariableProps>[0]
    );

    expect(props.variableName).toBe(CLI_RELATIVE_TIME.k);
    expect(props.variableType).toBe(CLI_RELATIVE_TIME.v);
  });

  it('renders a date-based RelativeTime inside T as relative time', () => {
    initializeI18nConfig({ defaultLocale: 'en' });
    onTestFinished(() => {
      Reflect.deleteProperty(globalThis, '__generaltranslation');
    });

    const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = renderDefaultChildren({
      children: addGTIdentifier(<RelativeTime date={date} />),
      defaultLocale: 'en',
      enableI18n: true,
    });

    expect(isValidElement(result)).toBe(true);
    if (!isValidElement(result)) return;
    expect(result.type).toBe(GtInternalRelativeTime);

    const rendered = GtInternalRelativeTime(
      result.props as Parameters<typeof GtInternalRelativeTime>[0]
    );
    expect(rendered).toMatch(/ago/);
  });
});

describe('addGTIdentifier non-variable tags', () => {
  it('tags a manual Plural with its branches', () => {
    expect(getTag(<Plural n={1} one='One' other='Many' />)).toMatchObject({
      injectionType: 'manual',
      transformation: 'plural',
      branches: { one: 'One', other: 'Many' },
    });
  });

  it('tags a compiler-inserted Plural as automatic', () => {
    expect(
      getTag(<GtInternalPlural n={1} one='One' other='Many' />)
    ).toMatchObject({
      injectionType: 'automatic',
      transformation: 'plural',
    });
  });

  it('tags a compiler-inserted Branch as automatic', () => {
    expect(
      getTag(
        <GtInternalBranch branch='a' a='A'>
          Fallback
        </GtInternalBranch>
      )
    ).toMatchObject({
      injectionType: 'automatic',
      transformation: 'branch',
      branches: { a: 'A' },
    });
  });

  it('converts a nested T to a fragment', () => {
    expect(getTag(<T>Hello</T>)).toMatchObject({
      injectionType: 'manual',
      transformation: 'fragment',
    });
  });

  it('converts a compiler-inserted nested T to an automatic fragment', () => {
    expect(
      getTag(<GtInternalTranslateJsx>Hello</GtInternalTranslateJsx>)
    ).toMatchObject({
      injectionType: 'automatic',
      transformation: 'fragment',
    });
  });

  it('leaves plain elements untransformed', () => {
    const tag = getTag(<b>Hello</b>);
    expect(tag).toEqual({ id: 1, injectionType: 'manual' });
  });
});
