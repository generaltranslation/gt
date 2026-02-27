'use client';
import { useLocale } from 'gt-next/client';

export default function LocaleDisplay() {
  return <p data-testid="client-locale">{useLocale()}</p>;
}
