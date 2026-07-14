import React, { useCallback, useMemo } from 'react';
import { AddIcon, RemoveCircleIcon } from '@sanity/icons';
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Label,
  Stack,
  Text,
  Tooltip,
} from '@sanity/ui';
import {
  ArrayOfObjectsItem,
  MemberItemError,
  setIfMissing,
  unset,
  type ArrayOfObjectsInputProps,
  type ArraySchemaType,
  type FieldMember,
  type FormPatch,
  type ObjectItemProps,
  type ObjectSchemaType,
  type PatchEvent,
} from 'sanity';
import { randomKey } from '../utils/randomKey';

type LocaleItem = { _key: string; _type?: string; language?: string };

type GTArrayOptions = {
  sourceLocale: string;
  locales: string[];
  titles?: Record<string, string>;
};

function readGTOptions(
  schemaType: ArraySchemaType | ObjectSchemaType | undefined
): GTArrayOptions | undefined {
  const options = schemaType?.options as
    | { gtInternationalizedArray?: GTArrayOptions }
    | undefined;
  return options?.gtInternationalizedArray;
}

function toneFromValidation(
  validation: ObjectItemProps['validation']
): 'critical' | 'caution' | undefined {
  if (!validation?.length) return undefined;
  if (validation.some((marker) => marker.level === 'error')) return 'critical';
  if (validation.some((marker) => marker.level === 'warning')) return 'caution';
  return undefined;
}

function RemoveLocaleButton(props: {
  isSource: boolean;
  readOnly: boolean;
  onRemove: () => void;
}) {
  const { isSource, readOnly, onRemove } = props;
  const button = (
    // The span keeps the tooltip working when the button is disabled
    // (disabled buttons don't emit pointer events).
    <span style={{ paddingBottom: '2px' }}>
      <Button
        mode='bleed'
        icon={RemoveCircleIcon}
        tone='critical'
        disabled={readOnly || isSource}
        onClick={onRemove}
      />
    </span>
  );

  if (!isSource) return button;

  return (
    <Tooltip
      animate
      portal
      placement='top'
      fallbackPlacements={['right', 'left']}
      content={
        <Text muted size={1}>
          Can&apos;t remove the source language
        </Text>
      }
    >
      {button}
    </Tooltip>
  );
}

/**
 * Item component for generated `internationalizedArray*Value` objects.
 *
 * Replaces the default array item (collapsed preview row + edit dialog) with
 * an inline editor: the `value` field rendered in place, retitled with the
 * locale label, plus a remove button. This is what makes localized fields
 * read as "one labeled input per language" instead of a generic object list.
 */
export function InternationalizedValueItem(props: ObjectItemProps) {
  const { inputProps, parentSchemaType, schemaType, validation } = props;
  const value = props.value as LocaleItem & { value?: unknown };
  const { onChange } = inputProps;

  const gtOptions =
    readGTOptions(schemaType) ??
    readGTOptions(parentSchemaType as ArraySchemaType);
  const language = value?.language;
  const languageLabel = language
    ? (gtOptions?.titles?.[language] ?? language)
    : 'Unknown language';
  const isSource = !!language && language === gtOptions?.sourceLocale;

  // For array-based values (e.g. Portable Text), insert patches from the
  // nested input can arrive rooted at the item while `value` doesn't exist
  // yet; initialize it and re-root those patches under `value`.
  const wrappedOnChange = useCallback(
    (patch: FormPatch | FormPatch[] | PatchEvent) => {
      if (!Array.isArray(patch)) {
        onChange(patch);
        return;
      }
      const currentValue = value?.value;
      const valueIsEmpty =
        currentValue == null ||
        (Array.isArray(currentValue) && currentValue.length === 0);
      const needsRerooting =
        valueIsEmpty &&
        patch.some(
          (p) =>
            p.type === 'insert' &&
            Array.isArray(p.path) &&
            p.path.length > 0 &&
            (p.path[0] === 'value' || typeof p.path[0] === 'number')
        );
      if (!needsRerooting) {
        onChange(patch);
        return;
      }
      const rerooted = patch.map((p) =>
        p.type === 'insert' && Array.isArray(p.path) && p.path[0] !== 'value'
          ? { ...p, path: ['value', ...p.path] }
          : p
      );
      onChange(
        currentValue === undefined
          ? [setIfMissing([], ['value']), ...rerooted]
          : rerooted
      );
    },
    [onChange, value?.value]
  );

  // Render only the `value` field, with the locale label as its title.
  const members = useMemo(
    () =>
      inputProps.members
        .filter(
          (member): member is FieldMember =>
            member.kind === 'field' && member.name === 'value'
        )
        .map((member) => ({
          ...member,
          field: {
            ...member.field,
            schemaType: {
              ...member.field.schemaType,
              title: (
                <Label muted size={1}>
                  {languageLabel}
                </Label>
              ) as unknown as string,
            },
          },
        })),
    [inputProps.members, languageLabel]
  );

  const handleRemove = useCallback(() => {
    onChange(unset());
  }, [onChange]);

  return (
    <Card paddingTop={2} tone={toneFromValidation(validation)}>
      <Flex align='flex-end' gap={2}>
        <Box flex={1}>
          {inputProps.renderInput({
            ...inputProps,
            members,
            onChange: wrappedOnChange,
            // renderInput's parameter is typed as the base InputProps, which
            // doesn't know about object members.
          } as unknown as Parameters<typeof inputProps.renderInput>[0])}
        </Box>
        <RemoveLocaleButton
          isSource={isSource}
          readOnly={!!inputProps.readOnly}
          onRemove={handleRemove}
        />
      </Flex>
    </Card>
  );
}

/**
 * Input for generated `internationalizedArray*` fields.
 *
 * Renders items inline (each one an `InternationalizedValueItem`) instead of
 * the default array input's draggable preview rows, followed by one add
 * button per locale that doesn't have an entry yet. Each add button appends
 * `{ _key, _type, language }` so the new item lands with its locale preset
 * (the default "Add item" would create an item with no `language` — a dead
 * end, since `language` is read-only).
 */
export function InternationalizedArrayInput(props: ArrayOfObjectsInputProps) {
  const { members, schemaType, value, readOnly, onItemAppend } = props;
  const gtOptions = readGTOptions(schemaType);
  const itemType = schemaType.of[0]?.name;

  const handleAdd = useCallback(
    (language: string) => {
      const item: LocaleItem = { _key: randomKey(), _type: itemType, language };
      onItemAppend(item);
    },
    [onItemAppend, itemType]
  );

  if (!gtOptions) {
    // No locale config on the type (not generated by gtPlugin) — fall back
    // to the default array input rather than rendering a dead-end UI.
    return props.renderDefault(props);
  }

  const allLocales = [gtOptions.sourceLocale, ...gtOptions.locales];
  const existing = new Set(
    ((value as LocaleItem[] | undefined) ?? [])
      .map((item) => item.language)
      .filter(Boolean)
  );
  const missing = allLocales.filter((locale) => !existing.has(locale));

  return (
    <Stack space={3}>
      {members.length > 0 ? (
        <Stack space={2}>
          {members.map((member) =>
            member.kind === 'item' ? (
              <ArrayOfObjectsItem key={member.key} {...props} member={member} />
            ) : (
              <MemberItemError key={member.key} member={member} />
            )
          )}
        </Stack>
      ) : (
        <Card border tone='transparent' padding={3} radius={2}>
          <Text size={1} muted>
            This internationalized field currently has no translations.
          </Text>
        </Card>
      )}
      {!readOnly && missing.length > 0 ? (
        <Grid columns={Math.min(missing.length, 4)} gap={1}>
          {missing.map((locale) => (
            <Button
              key={locale}
              icon={AddIcon}
              mode='ghost'
              text={gtOptions.titles?.[locale] ?? locale}
              onClick={() => handleAdd(locale)}
            />
          ))}
        </Grid>
      ) : null}
    </Stack>
  );
}
