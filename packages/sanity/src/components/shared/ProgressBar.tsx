// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { Card, Flex, Label } from '@sanity/ui';

export default function ProgressBar({ progress }: { progress: number }) {
  if (typeof progress === 'undefined') {
    console.warn('No progress prop passed to ProgressBar');
    return null;
  }

  return (
    <Card border radius={2} style={{ width: `100%`, position: `relative` }}>
      <Flex
        style={{
          position: `absolute`,
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 1,
        }}
        align='center'
        justify='center'
      >
        <Label size={1}>{progress}%</Label>
      </Flex>
      <Card
        style={{
          width: '100%',
          transform: `scaleX(${progress / 100})`,
          transformOrigin: 'left',
          transition: 'transform .2s ease',
          boxSizing: 'border-box',
        }}
        padding={2}
        tone='positive'
      />
    </Card>
  );
}
