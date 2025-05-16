import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Logo from '@/components/Logo';

import { Book, Earth, MessageSquareText } from 'lucide-react';
import { SiDiscord } from '@icons-pack/react-simple-icons';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export async function baseOptions(locale: string): Promise<BaseLayoutProps> {
  const translations = {
    en: (await import('@/content/ui.en.json')).default,
    zh: (await import('@/content/ui.zh.json')).default,
    de: (await import('@/content/ui.de.json')).default,
    fr: (await import('@/content/ui.fr.json')).default,
    es: (await import('@/content/ui.es.json')).default,
    ja: (await import('@/content/ui.ja.json')).default,
  }[locale];
  return {
    i18n: true,
    nav: {
      title: (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Logo />
          &nbsp;&nbsp;General Translation&nbsp;&nbsp;
        </div>
      ),
      url: '/',
    },
    links: [
      {
        text: translations?.docs || 'Docs',
        url: '/docs',
        active: 'nested-url',
        icon: <Book />,
      },
      {
        text: translations?.dashboard || 'Dashboard',
        url: '/dashboard',
        active: 'nested-url',
        icon: <Earth />,
      },
      {
        text: translations?.blog || 'Blog',
        url: '/blog',
        active: 'nested-url',
        icon: <MessageSquareText />,
      },
      {
        text: 'Discord',
        url: 'https://discord.gg/W99K6fchSu',
        active: 'nested-url',
        icon: <SiDiscord />,
      },
    ],
    githubUrl: 'https://github.com/generaltranslation/gt',
  };
}
