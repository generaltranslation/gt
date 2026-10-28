import { useCallback } from 'react';
import { Button, ButtonMode, Checkbox, Flex } from '@sanity/ui';
import { TranslationLocale } from '../../types';
import { LocaleLabel } from './LocaleLabel';

type LocaleCheckboxProps = {
  locale: TranslationLocale;
  toggle: (locale: string, shouldEnable: boolean) => void;
  checked: boolean;
  mode?: ButtonMode;
  padding?: number;
};

export const LocaleCheckbox = ({
  locale,
  toggle,
  checked,
  mode = 'ghost',
  padding = 3,
}: LocaleCheckboxProps) => {
  const onClick = useCallback(
    () => toggle(locale.localeId, !checked),
    [locale.localeId, toggle, checked]
  );

  return (
    <Button
      mode={mode}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      padding={padding}
    >
      <Flex align='center' gap={3}>
        <Checkbox
          style={{ pointerEvents: 'none' }}
          onChange={onClick}
          checked={checked}
        />
        <LocaleLabel localeId={locale.localeId} />
      </Flex>
    </Button>
  );
};
