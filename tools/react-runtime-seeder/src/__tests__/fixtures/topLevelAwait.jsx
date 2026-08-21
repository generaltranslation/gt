import { T } from 'gt-react';

const label = await Promise.resolve('Top-level await');

export default function Seed() {
  return <T>{label}</T>;
}
