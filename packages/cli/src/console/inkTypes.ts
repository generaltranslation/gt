import type { ReactNode } from 'react';

export type PromptOption<T> = {
  value: T;
  label: string;
  hint?: string;
};

export type PromptResult<T> = {
  value?: T;
  cancelled: boolean;
};

export type TextPromptProps = {
  message: string;
  defaultValue?: string;
  validate?: (value: string) => boolean | string;
  onComplete: (result: PromptResult<string>) => void;
};

export type LocaleOption = {
  code: string;
  label: string;
  name: string;
  nativeName: string;
  searchable: string;
};

export type LocalePromptProps = {
  message: string;
  defaultValue?: string;
  onComplete: (result: PromptResult<string>) => void;
};

export type LocaleMultiPromptProps = {
  message: string;
  defaultValue?: string[];
  required: boolean;
  onComplete: (result: PromptResult<string[]>) => void;
};

export type GlobPromptProps = {
  label: string;
  message?: string;
  defaultValue?: string;
  onComplete: (result: PromptResult<string>) => void;
};

export type EditableTextPromptProps = TextPromptProps & {
  footer?: string;
  placeholder?: string;
};

export type SelectPromptProps<T> = {
  message: string;
  options: Array<PromptOption<T>>;
  defaultValue?: T;
  onComplete: (result: PromptResult<T>) => void;
};

export type MultiSelectPromptProps<T extends string> = {
  message: string;
  options: Array<PromptOption<T>>;
  required: boolean;
  onComplete: (result: PromptResult<Array<T>>) => void;
};

export type ConfirmPromptProps = {
  message: string;
  defaultValue?: boolean;
  onComplete: (result: PromptResult<boolean>) => void;
};

export type PromptFrameProps = {
  message: string;
  children: ReactNode;
  footer: string;
};
