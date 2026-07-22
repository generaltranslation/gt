import { Box, Text } from 'ink';
import { getLocaleCodeWidth } from './inkLocaleData.js';
import { INK_ACCENT_COLOR } from './inkTheme.js';
import type { LocaleOption } from './inkTypes.js';
import { stripAnsi, truncate } from './inkUtils.js';

export function OptionRow({
  active,
  selected,
  label,
  hint,
  width,
}: {
  active: boolean;
  selected?: boolean;
  label: string;
  hint?: string;
  width?: number;
}) {
  const marker = active ? '>' : ' ';
  const selectedMarker = selected == null ? '' : selected ? '[x] ' : '[ ] ';
  const text = `${marker} ${selectedMarker}${stripAnsi(label)}${
    hint ? ` ${stripAnsi(hint)}` : ''
  }`;

  return active ? (
    <Text color={INK_ACCENT_COLOR} bold>
      {width ? truncate(text, width) : text}
    </Text>
  ) : (
    <Text>{width ? truncate(text, width) : text}</Text>
  );
}

export function SelectedTags({
  selectedLocales,
  active,
  activeIndex,
  width,
}: {
  selectedLocales: string[];
  active: boolean;
  activeIndex: number;
  width: number;
}) {
  if (selectedLocales.length === 0) return null;

  return (
    <Box width={width} flexWrap='wrap'>
      <Text dimColor>Selected </Text>
      {selectedLocales.map((locale, index) => {
        const isActive = active && index === activeIndex;
        return (
          <Text key={locale}>
            <Text
              backgroundColor={isActive ? INK_ACCENT_COLOR : 'gray'}
              color='black'
              bold={isActive}
            >{` ${locale} `}</Text>
            {index < selectedLocales.length - 1 ? <Text> </Text> : null}
          </Text>
        );
      })}
    </Box>
  );
}

export function LocaleOptionsList({
  options,
  activeIndex,
  width,
}: {
  options: LocaleOption[];
  activeIndex: number;
  width: number;
}) {
  const codeWidth = getLocaleCodeWidth();
  return (
    <Box flexDirection='column' marginTop={1}>
      {options.map((option, index) => (
        <LocaleRow
          key={option.code}
          active={index === activeIndex}
          option={option}
          width={width}
          codeWidth={codeWidth}
        />
      ))}
    </Box>
  );
}

function LocaleRow({
  active,
  option,
  width,
  codeWidth,
}: {
  active: boolean;
  option: LocaleOption;
  width: number;
  codeWidth: number;
}) {
  const marker = active ? '>' : ' ';
  const sameName = option.name === option.nativeName;
  const codeStr = option.code.padEnd(codeWidth);
  const reserved = 2 + codeWidth + 2;
  if (width < reserved) {
    const compactText = truncate(`${marker} ${option.code}`, width);
    return active ? (
      <Text color={INK_ACCENT_COLOR} bold>
        {compactText}
      </Text>
    ) : (
      <Text>{compactText}</Text>
    );
  }

  const remainingForName = Math.max(1, width - reserved);
  const nameMax = sameName
    ? remainingForName
    : Math.max(1, Math.ceil(remainingForName * 0.55));
  const truncatedName = truncate(option.name, nameMax);
  const nativeMax = sameName
    ? 0
    : Math.max(1, remainingForName - truncatedName.length - 2);
  const truncatedNative = sameName
    ? ''
    : truncate(option.nativeName, nativeMax);

  if (active) {
    return (
      <Text color={INK_ACCENT_COLOR} bold>
        {`${marker} ${codeStr}  ${truncatedName}`}
        {sameName ? '' : `  ${truncatedNative}`}
      </Text>
    );
  }

  return (
    <Text>
      <Text>{`${marker} `}</Text>
      <Text dimColor>{codeStr}</Text>
      <Text>{`  ${truncatedName}`}</Text>
      {sameName ? null : <Text dimColor italic>{`  ${truncatedNative}`}</Text>}
    </Text>
  );
}

export function RemainingMatches({
  total,
  visible,
}: {
  total: number;
  visible: number;
}) {
  const remaining = total - visible;
  if (remaining <= 0) return null;
  return <Text dimColor>{remaining} more matches</Text>;
}
