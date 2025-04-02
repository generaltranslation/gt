import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Logo from '@/components/Logo';

import { Earth, MessageSquareText } from 'lucide-react';
import { SiDiscord } from '@icons-pack/react-simple-icons';
import { getDict } from 'gt-next/server';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export async function baseOptions(): Promise<BaseLayoutProps> {
  const t = await getDict();
  return {
    i18n: true,
    nav: {
      title: (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Logo />
          &nbsp;&nbsp;General Translation&nbsp;&nbsp;
        </div>
      ),
      url: '/docs',
    },
    links: [
      {
        text: t('dashboard'),
        url: '/dashboard',
        active: 'nested-url',
        icon: <Earth />,
      },
      {
        text: t('blog'),
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
    githubUrl: 'https://github.com/General-Translation/gt-libraries',
  };
}
