'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useLayoutEffect, useState } from 'react';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? process.env.NEXT_PUBLIC_APP_URL + '/'
  : 'https://gt-docs-ten.vercel.app/';
const REACT_QUICK_START = '/docs/react';
const NEXT_QUICK_START = '/docs/next';

const LOGOS: Record<
  string,
  {
    lightLogo: string;
    darkLogo: string;
    lightWordmark: string;
    darkWordmark: string;
    name: string;
    href: string;
    alt: string;
  }
> = {
  react: {
    lightLogo: 'logos/react-logo-light.svg',
    darkLogo: 'logos/react-logo-dark.svg',
    lightWordmark: 'logos/react-wordmark-light.svg',
    darkWordmark: 'logos/react-wordmark-dark.svg',
    name: 'React',
    href: REACT_QUICK_START,
    alt: 'React Logo',
  },
  nextjs: {
    lightLogo: 'logos/nextjs-logo.svg',
    darkLogo: 'logos/nextjs-logo.svg',
    lightWordmark: 'logos/nextjs-wordmark.svg',
    darkWordmark: 'logos/nextjs-wordmark.svg',
    name: 'Next.js',
    href: NEXT_QUICK_START,
    alt: 'Next.js Logo',
  },
  viteLogo: {
    lightLogo: 'logos/vite-logo.svg',
    darkLogo: 'logos/vite-logo.svg',
    lightWordmark: 'logos/vite-logo.svg',
    darkWordmark: 'logos/vite-logo.svg',
    name: 'Vite + React',
    href: REACT_QUICK_START,
    alt: 'Vite Logo',
  },
  gatsby: {
    lightLogo: 'logos/gatsby-logo.svg',
    darkLogo: 'logos/gatsby-logo.svg',
    lightWordmark: 'logos/gatsby-wordmark.svg',
    darkWordmark: 'logos/gatsby-wordmark.svg',
    name: 'Gatsby',
    href: REACT_QUICK_START,
    alt: 'Gatsby Logo',
  },
  redwoodjs: {
    lightLogo: 'logos/redwoodjs-logo-light.svg',
    darkLogo: 'logos/redwoodjs-logo-dark.svg',
    lightWordmark: 'logos/redwoodjs-wordmark-light.svg',
    darkWordmark: 'logos/redwoodjs-wordmark-dark.svg',
    name: 'RedwoodJS',
    href: REACT_QUICK_START,
    alt: 'RedwoodJS Logo',
  },
  createreactapp: {
    lightLogo: 'logos/react-logo-light.svg',
    darkLogo: 'logos/react-logo-dark.svg',
    lightWordmark: 'logos/react-wordmark-light.svg',
    darkWordmark: 'logos/react-wordmark-dark.svg',
    name: 'create-react-app',
    href: REACT_QUICK_START,
    alt: 'React Logo',
  },
  other: {
    lightLogo: 'gt-logo-light.svg',
    darkLogo: 'gt-logo-dark.svg',
    lightWordmark: 'gt-logo-light.svg',
    darkWordmark: 'gt-logo-dark.svg',
    name: 'Other',
    href: REACT_QUICK_START,
    alt: 'General Translation Inc. Logo',
  },
};

const LogoCardContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex flex-wrap gap-4 justify-center items-center',
      className
    )}
    {...props}
  />
));
LogoCardContainer.displayName = 'LogoCardContainer';

const LogoCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { src: string }
>(({ className, src, ...props }, ref) => {
  const router = useRouter();

  const handleClick = () => {
    if (src && LOGOS[src]?.href) {
      router.push(LOGOS[src].href);
    }
  };

  return (
    <div
      ref={ref}
      className={cn('logo-card', className)}
      style={{ cursor: 'pointer' }}
      onClick={handleClick}
      {...props}
    />
  );
});
LogoCard.displayName = 'LogoCard';

const LogoCardImage = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { src: string }
>(({ className, src, ...props }, ref) => {
  const { resolvedTheme } = useTheme();
  const [logoSrc, setLogoSrc] = useState('');

  useLayoutEffect(() => {
    setLogoSrc(
      BASE_URL +
        (resolvedTheme === 'dark'
          ? LOGOS[src]?.darkLogo
          : LOGOS[src]?.lightLogo)
    );
  }, [resolvedTheme]);

  if (!logoSrc) return;

  return (
    <div ref={ref} className={className} {...props}>
      <img
        src={logoSrc}
        alt={LOGOS[src]?.alt || 'Logo'}
        className="logo-card-image"
      />
    </div>
  );
});
LogoCardImage.displayName = 'LogoCardImage';

const LogoCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('logo-card-content', className)} {...props} />
));
LogoCardContent.displayName = 'LogoCardContent';

const AllLogoCards = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <LogoCardContainer ref={ref} className={className} {...props}>
    {Object.keys(LOGOS).map((key) => (
      <LogoCard key={key} src={key}>
        <LogoCardImage src={key} />
        <LogoCardContent>{LOGOS[key].name}</LogoCardContent>
      </LogoCard>
    ))}
  </LogoCardContainer>
));
AllLogoCards.displayName = 'AllLogoCards';

export {
  LogoCardContainer,
  LogoCard,
  LogoCardImage,
  LogoCardContent,
  AllLogoCards,
};
