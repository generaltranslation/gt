import { defineField } from 'sanity';
import { expect, test } from 'vitest';
import '../schemaOptions';

// Compile-time check: the module augmentation must make `options.gt`
// type-check on ordinary field definitions.
const field = defineField({
  name: 'internalNotes',
  type: 'string',
  options: { gt: { exclude: true } },
});

test('options.gt.exclude is accepted by defineField', () => {
  expect((field.options as { gt?: { exclude?: boolean } }).gt?.exclude).toBe(
    true
  );
});
