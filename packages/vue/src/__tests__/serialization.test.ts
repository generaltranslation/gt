import { describe, expect, it } from 'vitest';
import { Fragment, h } from 'vue';
import { T } from '../components/T';
import { Branch, Plural } from '../components/branches';
import { Currency, DateTime, Num, Var } from '../components/variables';
import { tagChildren } from '../internal/tagChildren';
import { writeChildrenAsObjects } from '../internal/writeChildrenAsObjects';

function serialize(children: unknown) {
  return writeChildrenAsObjects(tagChildren(children as never));
}

describe('tagChildren + writeChildrenAsObjects', () => {
  it('serializes plain strings', () => {
    expect(serialize(['Hello, world!'])).toEqual(['Hello, world!']);
  });

  it('serializes nested elements with sequential ids', () => {
    const wire = serialize([
      h('p', null, ['Hello ', h('b', null, 'world'), '!']),
    ]);
    expect(wire).toEqual([
      {
        t: 'p',
        i: 1,
        d: undefined,
        c: ['Hello ', { t: 'b', i: 2, d: undefined, c: 'world' }, '!'],
      },
    ]);
  });

  it('serializes variable components as { i, k, v }', () => {
    const wire = serialize([
      h('p', null, [
        'Hi ',
        h(Var, { name: 'user' }, { default: () => 'Alice' }),
        ', you have ',
        h(Num, { value: 5 }),
        ' and ',
        h(Currency, { value: 10, currency: 'EUR' }),
        ' due ',
        h(DateTime, { value: new Date() }),
      ]),
    ]);
    expect(wire).toEqual([
      {
        t: 'p',
        i: 1,
        d: undefined,
        c: [
          'Hi ',
          { i: 2, k: 'user', v: 'v' },
          ', you have ',
          { i: 3, k: '_gt_n_3', v: 'n' },
          ' and ',
          { i: 4, k: '_gt_cost_4', v: 'c' },
          ' due ',
          { i: 5, k: '_gt_date_5', v: 'd' },
        ],
      },
    ]);
  });

  it('serializes plural branches with parallel ids', () => {
    const wire = serialize([
      h(
        Plural,
        { n: 1 },
        {
          one: () => [h('p', null, 'One item')],
          other: () => [h('p', null, 'Some items')],
        }
      ),
    ]);
    expect(wire).toEqual([
      {
        t: 'Plural',
        i: 1,
        d: {
          t: 'p',
          b: {
            one: [{ t: 'p', i: 2, d: undefined, c: 'One item' }],
            other: [{ t: 'p', i: 2, d: undefined, c: 'Some items' }],
          },
        },
      },
    ]);
  });

  it('serializes branch components with named slots', () => {
    const wire = serialize([
      h(
        Branch,
        { branch: 'active' },
        {
          active: () => 'Active',
          inactive: () => 'Inactive',
          default: () => 'Unknown',
        }
      ),
    ]);
    expect(wire).toEqual([
      {
        t: 'Branch',
        i: 1,
        d: {
          t: 'b',
          b: {
            active: 'Active',
            inactive: 'Inactive',
          },
        },
        c: 'Unknown',
      },
    ]);
  });

  it('serializes translatable html content props', () => {
    const wire = serialize([h('input', { placeholder: 'Enter email' })]);
    expect(wire).toEqual([{ t: 'input', i: 1, d: { pl: 'Enter email' } }]);
  });

  it('treats nested <T> as a fragment', () => {
    const wire = serialize([h(T, null, { default: () => 'inner' })]);
    expect(wire).toEqual([{ t: 'T', i: 1, d: undefined, c: 'inner' }]);
  });

  it('flattens fragments and skips comments', () => {
    const wire = serialize([h(Fragment, null, ['a', h('b', null, 'c')])]);
    expect(wire).toEqual([
      {
        t: 'C1',
        i: 1,
        d: undefined,
        c: ['a', { t: 'b', i: 2, d: undefined, c: 'c' }],
      },
    ]);
  });

  it('stringifies numbers', () => {
    expect(serialize(['Count: ', 42])).toEqual(['Count: ', '42']);
  });
});
