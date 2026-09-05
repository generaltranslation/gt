import { describe, expect, it } from 'vitest';
import { canonical, lower, oracle, readableOutput } from './oracle';

describe('parity comparison preserves user semantics', () => {
  it.each([
    ['<div key={void track()}>Hello</div>', '<div>Hello</div>'],
    [
      'export const _jsxFileName = track(); <div>Hello</div>',
      '<div>Hello</div>',
    ],
    [
      '<div children="Hello" {...props} />',
      '<div {...props} children="Hello" />',
    ],
    ['<div children="Hello">World</div>', '<div>Hello World</div>'],
    ['<div>{["Hello", value]}</div>', '<div>{[["Hello", value]]}</div>'],
    ['import "gt-next"; <div>Hello</div>', '<div>Hello</div>'],
    ['function jsx() { return track(); } jsx();', 'track();'],
    [
      'import {createElement as make} from "react"; export const factory=make; export function render(make){ const file="user-file"; return make("div",{__source:{fileName:file,lineNumber:1,columnNumber:2},__self:this,value}); }',
      'import {createElement as make} from "react"; export const factory=make; export function render(make){ const file="user-file"; return make("div",{__source:{fileName:file,lineNumber:99,columnNumber:2},__self:this,value}); }',
    ],
    [
      'import {jsx as helper} from "react/jsx-runtime"; const $jsx = local; export const Keep = helper; export const Page = () => <p>Value {$jsx(value)}</p>;',
      'import {jsx as helper} from "react/jsx-runtime"; const $jsx = local; export const Keep = helper; export const Page = () => <p>Value {helper(value)}</p>;',
    ],
  ])('distinguishes %s', (first, second) => {
    expect(canonical(lower(first))).not.toBe(canonical(lower(second)));
  });

  it.each([
    '<div children="Hello" {...props} />',
    '<div children="Hello">World</div>',
    '<div key={void track()}>Hello</div>',
    '<div key="before" {...props}>Hello</div>',
    '<div>{["Hello", value]}</div>',
    'export const _jsxFileName = track(); <div>Hello</div>',
  ])('roundtrips the compiler-authored fixture for %s', (input) => {
    const expected = oracle(input);
    expect(canonical(lower(readableOutput(expected)))).toBe(
      canonical(expected)
    );
  });
});
