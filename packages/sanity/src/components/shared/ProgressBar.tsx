// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { Card, Flex, Text } from '@sanity/ui';

export default function ProgressBar({ progress }: { progress: number }) {
  if (typeof progress === 'undefined') {
    console.warn('No progress prop passed to ProgressBar');
    return null;
  }

  return (
    <Card
      radius={2}
      overflow='hidden'
      style={{ width: '100%', position: 'relative' }}
    >
      {/* Fill layer, clipped to the rounded card. */}
      <Card
        tone='positive'
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scaleX(${progress / 100})`,
          transformOrigin: 'left',
          transition: 'transform .2s ease',
        }}
      />
      {/* Border drawn above the fill, following the rounded corners. Uses an
          inset shadow like @sanity/ui buttons so it adds no height. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          boxShadow: 'inset 0 0 0 1px var(--card-border-color)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
      {/* Same padding + text size as the adjacent Import button, so both
          render at exactly the same height. */}
      <Flex
        align='center'
        justify='center'
        padding={2}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <Text size={1} weight='medium'>
          {progress}%
        </Text>
      </Flex>
    </Card>
  );
}
