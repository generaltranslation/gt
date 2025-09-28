'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useLayoutEffect, useState } from 'react';

export default function Logo() {
  const { resolvedTheme } = useTheme();
  const [logoSrc, setLogoSrc] = useState('');

  useLayoutEffect(() => {
    setLogoSrc(
      resolvedTheme === 'dark'
        ? '/no-bg-gt-logo-dark.png'
        : '/no-bg-gt-logo-light.png'
    );
  }, [resolvedTheme]);

  const resolvedLogoSrc = logoSrc || '/no-bg-gt-logo-light.png';

  return (
    <span className="flex items-center gap-2 text-lg font-semibold">
      <Image src={resolvedLogoSrc} width={35} height={35} alt="GT" />
      <span className="sr-only">General Translation, Inc.</span>
    </span>
  );
}
