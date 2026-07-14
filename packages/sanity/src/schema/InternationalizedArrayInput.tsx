import React, { useCallback } from 'react';
import { AddIcon } from '@sanity/icons';
import { Button, Grid } from '@sanity/ui';
import type {
  ArrayInputFunctionsProps,
  ArrayOfObjectsInputProps,
  ArraySchemaType,
} from 'sanity';
import { randomKey } from '../utils/randomKey';

type LocaleItem = { _key: string; _type?: string; language?: string };

type GTArrayOptions = {
  sourceLocale: string;
  locales: string[];
  titles?: Record<string, string>;
};

function readGTOptions(
  schemaType: ArraySchemaType
): GTArrayOptions | undefined {
  const options = schemaType.options as
    | { gtInternationalizedArray?: GTArrayOptions }
    | undefined;
  return options?.gtInternationalizedArray;
}

/**
 * Replaces the default array "Add item" button (which would create an item
 * with no `language` — a dead end, since `language` is read-only) with one
 * add button per locale that doesn't have an entry yet. Each button appends
 * `{ _key, _type, language }` so the new item lands with its locale preset.
 */
function AddLocaleFunctions(
  props: ArrayInputFunctionsProps<LocaleItem, ArraySchemaType>
) {
  const { schemaType, value, readOnly, onItemAppend } = props;
  const gtOptions = readGTOptions(schemaType);
  const itemType = schemaType.of[0]?.name;

  const handleAdd = useCallback(
    (language: string) => {
      onItemAppend({ _key: randomKey(), _type: itemType, language });
    },
    [onItemAppend, itemType]
  );

  if (!gtOptions || readOnly) {
    return null;
  }

  const allLocales = [gtOptions.sourceLocale, ...gtOptions.locales];
  const existing = new Set(
    (value ?? []).map((item) => item.language).filter(Boolean)
  );
  const missing = allLocales.filter((locale) => !existing.has(locale));

  if (missing.length === 0) {
    return null;
  }

  return (
    <Grid columns={Math.min(missing.length, 4)} gap={1}>
      {missing.map((locale) => (
        <Button
          key={locale}
          icon={AddIcon}
          mode="ghost"
          text={gtOptions.titles?.[locale] ?? locale}
          onClick={() => handleAdd(locale)}
        />
      ))}
    </Grid>
  );
}

/**
 * v1 input for generated `internationalizedArray*` fields.
 *
 * Renders Sanity's default array input for the items themselves, but swaps
 * the array functions (the "Add item" affordance) for per-locale add buttons.
 * Richer UX (source first, auto-created source row, status badges,
 * copy-from-source, single-field translate) is deferred to a follow-up —
 * this component is the wiring point those features will grow into.
 */
export function InternationalizedArrayInput(props: ArrayOfObjectsInputProps) {
  return props.renderDefault({
    ...props,
    arrayFunctions: AddLocaleFunctions,
  });
}
