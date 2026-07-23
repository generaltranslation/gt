import { Badge, Flex, Text } from '@sanity/ui';
import { getLocaleDisplay } from '../../utils/localeDisplay';

type LocaleLabelProps = {
  localeId: string;
  size?: number;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
};

/**
 * Locale display used across the plugin UI: flag emoji, plain language name,
 * and the locale code in a muted chip — e.g. `🇺🇸 English [en-US]`.
 */
export const LocaleLabel = ({
  localeId,
  size = 1,
  weight = 'medium',
}: LocaleLabelProps) => {
  const { emoji, name, code, verbatim } = getLocaleDisplay(localeId);

  return (
    <Flex align='center' gap={2}>
      {emoji && (
        <Text size={size} aria-hidden>
          {emoji}
        </Text>
      )}
      <Text size={size} weight={weight}>
        {name}
      </Text>
      {!verbatim && (
        <Badge fontSize={0} radius={2}>
          {code}
        </Badge>
      )}
    </Flex>
  );
};
