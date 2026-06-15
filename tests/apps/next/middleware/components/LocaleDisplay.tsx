'use client';
import { useLocale } from 'gt-next';

export default function LocaleDisplay() {
  return <p data-testid='client-locale'>{useLocale()}</p>;
}
