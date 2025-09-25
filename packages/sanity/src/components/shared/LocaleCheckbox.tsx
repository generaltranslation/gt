import { useCallback } from 'react';
import { Button, Flex, Switch, Box, Text } from '@sanity/ui';
import styled from 'styled-components';
import { TranslationLocale } from '../../types';

const WrapText = styled(Box)`
  white-space: normal;
`;

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
      radius={2}
    >
      <Flex align='center' gap={3}>
        <Switch
          style={{ pointerEvents: 'none' }}
          onChange={onClick}
          checked={checked}
        />
        <WrapText>
          <Text size={1} weight='semibold'>
            {locale.description}
          </Text>
        </WrapText>
      </Flex>
    </Button>
  );
};
