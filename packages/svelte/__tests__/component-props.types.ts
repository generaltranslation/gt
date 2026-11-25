import type { ComponentProps } from 'svelte';
import type RelativeTime from '../src/components/RelativeTime.svelte';

export const relativeTimeProps: ComponentProps<typeof RelativeTime>[] = [
  {},
  { value: null },
  { value: new Date(), baseDate: new Date() },
  { value: 3, unit: 'day', options: { numeric: 'auto' } },
  // @ts-expect-error A numeric value needs a unit.
  { value: 3 },
];
