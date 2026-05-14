import { Box, Text } from 'ink';
import { PACKAGE_VERSION } from '../generated/version.js';
import { useTerminalSize } from './inkTerminal.js';
import { INK_ACCENT_COLOR } from './inkTheme.js';
import type { PromptFrameProps } from './inkTypes.js';
import {
  getContentWidth,
  normalizedMessage,
  truncate,
  wrapText,
} from './inkUtils.js';

export function PromptFrame({ message, children, footer }: PromptFrameProps) {
  const { columns, rows } = useTerminalSize();
  const width = getContentWidth(columns);
  const topPadding = Math.max(1, Math.min(5, Math.floor(rows * 0.1)));
  const showFeedback = columns >= 88;
  const footerText =
    columns < 50
      ? ultraCompactFooter(footer)
      : columns < 72
        ? compactFooter(footer)
        : footer;
  const messageLines = wrapText(normalizedMessage(message), width);
  const headerTitle = `  General Translation Wizard v${PACKAGE_VERSION}`;
  const headerFeedback = 'Feedback: support@generaltranslation.com  ';
  const headerGap = Math.max(
    1,
    columns - headerTitle.length - (showFeedback ? headerFeedback.length : 0)
  );
  const headerText = `${headerTitle}${' '.repeat(headerGap)}${
    showFeedback ? headerFeedback : ''
  }`;
  const footerLine = `  ${footerText}`.padEnd(columns, ' ');

  return (
    <Box width={columns} height={rows} flexDirection='column'>
      <Box width={columns}>
        <Text bold color='black' backgroundColor={INK_ACCENT_COLOR}>
          {headerText}
        </Text>
      </Box>

      <Box
        flexDirection='column'
        alignItems='center'
        paddingTop={topPadding}
        flexShrink={1}
      >
        <Box width={width} flexDirection='column'>
          <Box justifyContent='center'>
            <Text bold color={INK_ACCENT_COLOR}>
              GT Wizard
            </Text>
          </Box>
          <Box flexDirection='column' marginTop={1}>
            {messageLines.map((line, index) => (
              <Text key={`${index}-${line}`}>{line}</Text>
            ))}
          </Box>
          <Box marginTop={2} flexDirection='column'>
            {children}
          </Box>
        </Box>
      </Box>

      <Box flexGrow={1} />
      <Box width={columns}>
        <Text
          color='black'
          backgroundColor={INK_ACCENT_COLOR}
          wrap='truncate-end'
        >
          {footerLine}
        </Text>
      </Box>
    </Box>
  );
}

function compactFooter(footer: string) {
  return footer
    .replace('↑↓ navigate', '↑↓ move')
    .replace('enter confirm', 'enter done')
    .replace('enter select', 'enter choose')
    .replace('esc cancel', 'esc quit');
}

function ultraCompactFooter(footer: string) {
  return compactFooter(footer)
    .replace(/\s{2,}esc quit\s*$/, '')
    .replace('↑↓ move', '↑↓')
    .replace('space toggle', 'spc')
    .replace('enter done', 'enter')
    .replace('enter choose', 'enter')
    .replace('enter select', 'enter')
    .replace('enter save', 'enter')
    .replace('enter confirm', 'enter')
    .replace('type to edit', 'type')
    .replace('y/n select', 'y/n')
    .replace('←→ choose', '←→');
}

export function InputBox({
  value,
  width,
  placeholder,
}: {
  value: string;
  width: number;
  placeholder?: string;
}) {
  const innerWidth = Math.max(1, width - 4);
  const hasValue = value.length > 0;

  if (hasValue) {
    const visibleValue = truncate(value, Math.max(0, innerWidth - 1));
    const padding = Math.max(0, innerWidth - visibleValue.length - 1);
    return (
      <Box
        width={width}
        borderStyle='round'
        borderColor={INK_ACCENT_COLOR}
        paddingX={1}
      >
        <Text>{visibleValue}</Text>
        <Text inverse> </Text>
        <Text>{' '.repeat(padding)}</Text>
      </Box>
    );
  }

  const placeholderText = truncate(
    placeholder ?? '',
    Math.max(0, innerWidth - 1)
  );

  if (!placeholderText) {
    const padding = Math.max(0, innerWidth - 1);
    return (
      <Box
        width={width}
        borderStyle='round'
        borderColor={INK_ACCENT_COLOR}
        paddingX={1}
      >
        <Text inverse> </Text>
        <Text>{' '.repeat(padding)}</Text>
      </Box>
    );
  }

  const padding = Math.max(0, innerWidth - placeholderText.length);
  return (
    <Box
      width={width}
      borderStyle='round'
      borderColor={INK_ACCENT_COLOR}
      paddingX={1}
    >
      <Text inverse dimColor>
        {placeholderText.slice(0, 1)}
      </Text>
      <Text dimColor>{placeholderText.slice(1)}</Text>
      <Text>{' '.repeat(padding)}</Text>
    </Box>
  );
}
