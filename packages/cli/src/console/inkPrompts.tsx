import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getSupportedLocale } from '@generaltranslation/supported-locales';
import {
  OptionRow,
  LocaleOptionsList,
  RemainingMatches,
  SelectedTags,
} from './inkFields.js';
import { getFilteredLocaleOptions, getLocaleOptions } from './inkLocaleData.js';
import { InputBox, PromptFrame } from './inkLayout.js';
import { runPrompt } from './inkSession.js';
import { useTerminalSize } from './inkTerminal.js';
import { parseTypedLocale } from './promptParsing.js';
import type {
  ConfirmPromptProps,
  EditableTextPromptProps,
  GlobPromptProps,
  LocaleMultiPromptProps,
  LocalePromptProps,
  MultiSelectPromptProps,
  SelectPromptProps,
  TextPromptProps,
} from './inkTypes.js';
import {
  CANCELLED,
  SELECTED_TAG_ROW_INDEX,
  complete,
  getInputWidth,
  getOptionWidth,
  getSafeIndex,
  getScrollWindow,
  getVisibleCount,
  nextIndex,
  previousIndex,
} from './inkUtils.js';

function resolveLocaleChoice({
  query,
  highlightedLocale,
  preferHighlightedLocale,
}: {
  query: string;
  highlightedLocale?: string;
  preferHighlightedLocale: boolean;
}) {
  if (preferHighlightedLocale) return highlightedLocale;
  return parseTypedLocale(query) ?? highlightedLocale;
}

function TextPrompt({
  message,
  defaultValue,
  validate,
  onComplete,
  footer = 'type to edit   enter select   esc cancel',
  placeholder,
}: EditableTextPromptProps) {
  const { columns } = useTerminalSize();
  const [value, setValue] = useState(defaultValue ?? '');
  const [error, setError] = useState<string | undefined>();
  const inputWidth = getInputWidth(columns);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      complete(CANCELLED, onComplete);
      return;
    }
    if (key.return) {
      const validation = validate?.(value);
      if (validation && validation !== true) {
        setError(validation.toString());
        return;
      }
      complete({ value, cancelled: false }, onComplete);
      return;
    }
    if (key.backspace || key.delete) {
      setValue((current) => current.slice(0, -1));
      setError(undefined);
      return;
    }
    if (input && !key.ctrl && !key.meta && !key.return) {
      setValue((current) => current + input);
      setError(undefined);
    }
  });

  return (
    <PromptFrame message={message} footer={footer}>
      <InputBox value={value} width={inputWidth} placeholder={placeholder} />
      {error ? <Text color='red'>{error}</Text> : null}
    </PromptFrame>
  );
}

function LocalePrompt({
  message,
  defaultValue,
  onComplete,
}: LocalePromptProps) {
  const { columns, rows } = useTerminalSize();
  const localeOptions = getLocaleOptions();
  const defaultLocale = defaultValue ? getSupportedLocale(defaultValue) : null;
  const defaultIndex = defaultLocale
    ? Math.max(
        0,
        localeOptions.findIndex((option) => option.code === defaultLocale)
      )
    : 0;
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(defaultIndex);
  const [preferHighlightedLocale, setPreferHighlightedLocale] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const filteredOptions = getFilteredLocaleOptions(query);
  const activeIndex = getSafeIndex(index, filteredOptions.length);
  const visibleCount = getVisibleCount(rows, 14);
  const { start, visibleItems: visibleOptions } = getScrollWindow({
    items: filteredOptions,
    index: activeIndex,
    visibleCount,
  });
  const inputWidth = getInputWidth(columns);
  const optionWidth = getOptionWidth(columns);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      complete(CANCELLED, onComplete);
      return;
    }
    if (key.upArrow) {
      setPreferHighlightedLocale(true);
      setIndex((current) => previousIndex(current, filteredOptions.length));
      return;
    }
    if (key.downArrow) {
      setPreferHighlightedLocale(true);
      setIndex((current) => nextIndex(current, filteredOptions.length));
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((current) => current.slice(0, -1));
      setIndex(0);
      setPreferHighlightedLocale(false);
      setError(undefined);
      return;
    }
    if (key.return) {
      const finalLocale = resolveLocaleChoice({
        query,
        highlightedLocale: filteredOptions[activeIndex]?.code,
        preferHighlightedLocale,
      });
      if (!finalLocale) {
        setError('Enter a valid locale (e.g., en)');
        return;
      }
      complete({ value: finalLocale, cancelled: false }, onComplete);
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setQuery((current) => current + input);
      setIndex(0);
      setPreferHighlightedLocale(false);
      setError(undefined);
    }
  });

  return (
    <PromptFrame
      message={message}
      footer='↑↓ navigate   enter select   esc cancel'
    >
      <InputBox
        value={query}
        width={inputWidth}
        placeholder='Search locales...'
      />
      <LocaleOptionsList
        options={visibleOptions}
        activeIndex={activeIndex - start}
        width={optionWidth}
      />
      <RemainingMatches total={filteredOptions.length} visible={visibleCount} />
      {error ? <Text color='red'>{error}</Text> : null}
    </PromptFrame>
  );
}

function LocaleMultiPrompt({
  message,
  defaultValue = [],
  required,
  onComplete,
}: LocaleMultiPromptProps) {
  const { columns, rows } = useTerminalSize();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [preferHighlightedLocale, setPreferHighlightedLocale] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultValue));
  const [error, setError] = useState<string | undefined>();
  const selectedLocales = [...selected];
  const filteredOptions = getFilteredLocaleOptions(query).filter(
    (option) => !selected.has(option.code)
  );
  const activeOptionIndex = getSafeIndex(index, filteredOptions.length);
  const visibleCount = getVisibleCount(rows, 16);
  const { start, visibleItems: visibleOptions } = getScrollWindow({
    items: filteredOptions,
    index: activeOptionIndex,
    visibleCount,
  });
  const inputWidth = getInputWidth(columns);
  const optionWidth = getOptionWidth(columns);
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);
  const moveSelectedTag = (direction: -1 | 1) =>
    setSelectedTagIndex((current) =>
      Math.max(0, Math.min(selectedLocales.length - 1, current + direction))
    );
  const removeSelectedTag = () => {
    const localeToRemove = selectedLocales[selectedTagIndex];
    if (!localeToRemove) return;
    setSelected((current) => {
      const next = new Set(current);
      next.delete(localeToRemove);
      return next;
    });
    setSelectedTagIndex((current) =>
      Math.max(0, Math.min(current, selectedLocales.length - 2))
    );
    if (selectedLocales.length === 1) setIndex(0);
    setError(undefined);
  };
  const toggleVisibleLocale = () => {
    const selectedLocale = resolveLocaleChoice({
      query,
      highlightedLocale: filteredOptions[activeOptionIndex]?.code,
      preferHighlightedLocale,
    });
    if (!selectedLocale) {
      setError('Enter a valid locale (e.g., es fr de)');
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(selectedLocale)) {
        next.delete(selectedLocale);
      } else {
        next.add(selectedLocale);
      }
      return next;
    });
    setQuery('');
    setError(undefined);
  };

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      complete(CANCELLED, onComplete);
      return;
    }
    if (key.upArrow) {
      setPreferHighlightedLocale(true);
      setIndex((current) => {
        if (current === SELECTED_TAG_ROW_INDEX) {
          if (selectedTagIndex > 0) {
            moveSelectedTag(-1);
            return SELECTED_TAG_ROW_INDEX;
          }
          return Math.max(filteredOptions.length - 1, 0);
        }
        if (current === 0 && selectedLocales.length > 0) {
          setSelectedTagIndex(selectedLocales.length - 1);
          return SELECTED_TAG_ROW_INDEX;
        }
        if (current === 0) {
          return Math.max(filteredOptions.length - 1, 0);
        }
        return current - 1;
      });
      return;
    }
    if (key.downArrow) {
      setPreferHighlightedLocale(true);
      setIndex((current) => {
        if (filteredOptions.length === 0) return 0;
        if (current === SELECTED_TAG_ROW_INDEX) {
          if (selectedTagIndex < selectedLocales.length - 1) {
            moveSelectedTag(1);
            return SELECTED_TAG_ROW_INDEX;
          }
          return 0;
        }
        return nextIndex(current, filteredOptions.length);
      });
      return;
    }
    if (index === SELECTED_TAG_ROW_INDEX && key.leftArrow) {
      setSelectedTagIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (index === SELECTED_TAG_ROW_INDEX && key.rightArrow) {
      setSelectedTagIndex((current) =>
        Math.min(selectedLocales.length - 1, current + 1)
      );
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((current) => current.slice(0, -1));
      setIndex(0);
      setPreferHighlightedLocale(false);
      setError(undefined);
      return;
    }
    if (input === ' ' && index === SELECTED_TAG_ROW_INDEX) {
      removeSelectedTag();
      return;
    }
    if (input === ' ') {
      toggleVisibleLocale();
      return;
    }
    if (key.return) {
      if (required && selected.size === 0) {
        setError('Select at least one locale');
        return;
      }
      complete({ value: [...selected], cancelled: false }, onComplete);
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setQuery((current) => current + input);
      setIndex(0);
      setPreferHighlightedLocale(false);
      setError(undefined);
    }
  });

  return (
    <PromptFrame
      message={message}
      footer='↑↓ navigate   space toggle   enter confirm   esc cancel'
    >
      <InputBox
        value={query}
        width={inputWidth}
        placeholder='Search locales...'
      />
      <Box marginTop={1}>
        <SelectedTags
          selectedLocales={selectedLocales}
          active={index === SELECTED_TAG_ROW_INDEX}
          activeIndex={selectedTagIndex}
          width={optionWidth}
        />
      </Box>
      <LocaleOptionsList
        options={visibleOptions}
        activeIndex={
          index === SELECTED_TAG_ROW_INDEX
            ? SELECTED_TAG_ROW_INDEX
            : activeOptionIndex - start
        }
        width={optionWidth}
      />
      <RemainingMatches total={filteredOptions.length} visible={visibleCount} />
      {error ? <Text color='red'>{error}</Text> : null}
    </PromptFrame>
  );
}

function GlobPrompt({
  label,
  message,
  defaultValue,
  onComplete,
}: GlobPromptProps) {
  return (
    <TextPrompt
      message={
        message ??
        `${label}: Enter space-separated glob patterns for files to translate. Include [locale].`
      }
      defaultValue={defaultValue}
      footer='enter save   esc cancel'
      onComplete={onComplete}
    />
  );
}

function SelectPrompt<T>({
  message,
  options,
  defaultValue,
  onComplete,
}: SelectPromptProps<T>) {
  const defaultIndex = Math.max(
    0,
    options.findIndex((option) => option.value === defaultValue)
  );
  const [index, setIndex] = useState(defaultIndex);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      complete(CANCELLED, onComplete);
      return;
    }
    if (key.upArrow) {
      setIndex((current) => (current === 0 ? options.length - 1 : current - 1));
      return;
    }
    if (key.downArrow) {
      setIndex((current) => (current + 1) % options.length);
      return;
    }
    if (key.return) {
      complete({ value: options[index]?.value, cancelled: false }, onComplete);
    }
  });

  return (
    <PromptFrame
      message={message}
      footer='↑↓ navigate   enter select   esc cancel'
    >
      {options.map((option, optionIndex) => (
        <OptionRow
          key={optionIndex}
          active={optionIndex === index}
          label={option.label}
          hint={option.hint}
        />
      ))}
    </PromptFrame>
  );
}

function MultiSelectPrompt<T extends string>({
  message,
  options,
  required,
  onComplete,
}: MultiSelectPromptProps<T>) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | undefined>();

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      complete(CANCELLED, onComplete);
      return;
    }
    if (key.upArrow) {
      setIndex((current) => (current === 0 ? options.length - 1 : current - 1));
      return;
    }
    if (key.downArrow) {
      setIndex((current) => (current + 1) % options.length);
      return;
    }
    if (input === ' ') {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
      setError(undefined);
      return;
    }
    if (key.return) {
      if (required && selected.size === 0) {
        setError('Select at least one option');
        return;
      }
      const values = [...selected]
        .sort((a, b) => a - b)
        .map((selectedIndex) => options[selectedIndex]?.value)
        .filter((value): value is T => value != null);
      complete({ value: values, cancelled: false }, onComplete);
    }
  });

  return (
    <PromptFrame
      message={message}
      footer='↑↓ navigate   space toggle   enter select   esc cancel'
    >
      {options.map((option, optionIndex) => (
        <OptionRow
          key={optionIndex}
          active={optionIndex === index}
          selected={selected.has(optionIndex)}
          label={option.label}
          hint={option.hint}
        />
      ))}
      {error ? <Text color='red'>{error}</Text> : null}
    </PromptFrame>
  );
}

function ConfirmPrompt({
  message,
  defaultValue,
  onComplete,
}: ConfirmPromptProps) {
  const options = [
    { value: true, label: 'Yes' },
    { value: false, label: 'No' },
  ];
  const [index, setIndex] = useState(defaultValue ? 0 : 1);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      complete(CANCELLED, onComplete);
      return;
    }
    if (key.leftArrow || key.upArrow || key.rightArrow || key.downArrow) {
      setIndex((current) => (current === 0 ? 1 : 0));
      return;
    }
    if (input.toLowerCase() === 'y') {
      complete({ value: true, cancelled: false }, onComplete);
      return;
    }
    if (input.toLowerCase() === 'n') {
      complete({ value: false, cancelled: false }, onComplete);
      return;
    }
    if (key.return) {
      complete({ value: options[index]!.value, cancelled: false }, onComplete);
    }
  });

  return (
    <PromptFrame
      message={message}
      footer='←→ choose   y/n select   enter confirm   esc cancel'
    >
      {options.map((option, optionIndex) => (
        <OptionRow
          key={option.label}
          active={optionIndex === index}
          label={option.label}
        />
      ))}
    </PromptFrame>
  );
}

export async function inkPromptText(
  options: Omit<TextPromptProps, 'onComplete'>
) {
  return runPrompt<string>((onComplete) => (
    <TextPrompt {...options} onComplete={onComplete} />
  ));
}

export async function inkPromptLocale(
  options: Omit<LocalePromptProps, 'onComplete'>
) {
  return runPrompt<string>((onComplete) => (
    <LocalePrompt {...options} onComplete={onComplete} />
  ));
}

export async function inkPromptLocaleMulti(
  options: Omit<LocaleMultiPromptProps, 'onComplete'>
) {
  return runPrompt<string[]>((onComplete) => (
    <LocaleMultiPrompt {...options} onComplete={onComplete} />
  ));
}

export async function inkPromptGlob(
  options: Omit<GlobPromptProps, 'onComplete'>
) {
  return runPrompt<string>((onComplete) => (
    <GlobPrompt {...options} onComplete={onComplete} />
  ));
}

export async function inkPromptSelect<T>(
  options: Omit<SelectPromptProps<T>, 'onComplete'>
) {
  return runPrompt<T>((onComplete) => (
    <SelectPrompt {...options} onComplete={onComplete} />
  ));
}

export async function inkPromptMultiSelect<T extends string>(
  options: Omit<MultiSelectPromptProps<T>, 'onComplete'>
) {
  return runPrompt<Array<T>>((onComplete) => (
    <MultiSelectPrompt {...options} onComplete={onComplete} />
  ));
}

export async function inkPromptConfirm(
  options: Omit<ConfirmPromptProps, 'onComplete'>
) {
  return runPrompt<boolean>((onComplete) => (
    <ConfirmPrompt {...options} onComplete={onComplete} />
  ));
}
