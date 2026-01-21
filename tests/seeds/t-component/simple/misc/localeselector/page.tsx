import { T, LocaleSelector } from "gt-next";
export default function Home() {
  return (
    <T>
      Let&apos;s select some locales
      <LocaleSelector />
    </T>
  );
}