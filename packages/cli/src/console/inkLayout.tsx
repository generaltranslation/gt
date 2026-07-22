import { Box, Text } from 'ink';
import { PACKAGE_VERSION } from '../generated/version.js';
import { useTerminalSize } from './inkTerminal.js';
import { INK_ACCENT_COLOR } from './inkTheme.js';
import type { PromptFrameProps } from './inkTypes.js';
import {
  getContentWidth,
  limitLines,
  normalizedMessage,
  truncate,
  wrapText,
} from './inkUtils.js';

export function PromptFrame({ message, children, footer }: PromptFrameProps) {
  const { columns, rows } = useTerminalSize();
  const width = getContentWidth(columns);
  const topPadding = rows >= 10 ? 1 : 0;
  const showWizardTitle = rows >= 16;
  const showFeedback = columns >= 88;
  const footerText =
    columns < 50
      ? ultraCompactFooter(footer)
      : columns < 72
        ? compactFooter(footer)
        : footer;
  const messageLineLimit = rows < 14 ? 1 : rows < 18 ? 2 : 4;
  const messageLines = limitLines(
    wrapText(normalizedMessage(message), width),
    messageLineLimit,
    width
  );
  const headerTitle =
    columns < 44
      ? `  GT Wizard v${PACKAGE_VERSION}`
      : `  General Translation Wizard v${PACKAGE_VERSION}`;
  const headerFeedback = 'Feedback: support@generaltranslation.com  ';
  const headerGap = Math.max(
    1,
    columns - headerTitle.length - (showFeedback ? headerFeedback.length : 0)
  );
  const headerText = truncate(
    `${headerTitle}${' '.repeat(headerGap)}${
      showFeedback ? headerFeedback : ''
    }`,
    columns
  ).padEnd(columns, ' ');
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
          {showWizardTitle ? (
            <Box justifyContent='center'>
              <Text bold color={INK_ACCENT_COLOR}>
                GT Wizard
              </Text>
            </Box>
          ) : null}
          <Box flexDirection='column' marginTop={showWizardTitle ? 1 : 0}>
            {messageLines.map((line, index) => (
              <Text key={`${index}-${line}`}>{line}</Text>
            ))}
          </Box>
          <Box marginTop={1} flexDirection='column'>
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
    .replace('space toggle', 'space')
    .replace('enter done', 'done')
    .replace('enter choose', 'choose')
    .replace('enter save', 'save')
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
  const prefix = '> ';
  const innerWidth = Math.max(1, width - prefix.length - 1);
  const hasValue = value.length > 0;

  if (hasValue) {
    const visibleValue = truncate(value, innerWidth);
    const padding = Math.max(
      0,
      width - prefix.length - visibleValue.length - 1
    );
    return (
      <Box width={width}>
        <Text color={INK_ACCENT_COLOR}>{prefix}</Text>
        <Text>{visibleValue}</Text>
        <Text inverse> </Text>
        <Text>{' '.repeat(padding)}</Text>
      </Box>
    );
  }

  const placeholderText = truncate(placeholder ?? '', innerWidth);
  const cursorWidth = placeholderText ? 0 : 1;
  const padding = Math.max(
    0,
    width - prefix.length - placeholderText.length - cursorWidth
  );

  return (
    <Box width={width}>
      <Text color={INK_ACCENT_COLOR}>{prefix}</Text>
      {placeholderText ? (
        <>
          <Text inverse dimColor>
            {placeholderText.slice(0, 1)}
          </Text>
          <Text dimColor>{placeholderText.slice(1)}</Text>
        </>
      ) : null}
      <Text inverse>{placeholderText ? '' : ' '}</Text>
      <Text>{' '.repeat(padding)}</Text>
    </Box>
  );
}
