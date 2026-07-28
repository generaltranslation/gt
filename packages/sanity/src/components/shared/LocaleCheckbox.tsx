import { useCallback } from 'react';
import { Button, Checkbox, Flex } from '@sanity/ui';
import { TranslationLocale } from '../../types';
import { LocaleLabel } from './LocaleLabel';

type LocaleCheckboxProps = {
  locale: TranslationLocale;
  toggle: (locale: string, shouldEnable: boolean) => void;
  checked: boolean;
};

export const LocaleCheckbox = ({
  locale,
  toggle,
  checked,
}: LocaleCheckboxProps) => {
  const onClick = useCallback(
    () => toggle(locale.localeId, !checked),
    [locale.localeId, toggle, checked]
  );

  return (
    <Button
      mode='ghost'
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      padding={3}
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
