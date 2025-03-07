'use client';
import { ChevronUp } from 'lucide-react';
import Image from 'next/image';
import type { User } from 'next-auth';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Var, T, Branch } from 'gt-next';

export function SidebarUserNav({ user }: { user: User }) {
  const { setTheme, theme } = useTheme();

  return (
    <T id='components.sidebar_user_nav.0'>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className='data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10'>
                <Image
                  src={`https://avatar.vercel.sh/${user.email}`}
                  alt={user.email ?? 'User Avatar'}
                  width={24}
                  height={24}
                  className='rounded-full'
                />

                <span className='truncate'>
                  <Var>{user?.email}</Var>
                </span>
                <ChevronUp className='ml-auto' />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side='top'
              className='w-[--radix-popper-anchor-width]'
            >
              <DropdownMenuItem
                className='cursor-pointer'
                onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {/* <Var>{`Toggle ${theme === 'light' ? 'dark' : 'light'} mode`}</Var> */}
                <Branch branch={theme} light={'Toggle dark mode'}>
                  Toggle dark mode
                </Branch>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <button
                  type='button'
                  className='w-full cursor-pointer'
                  onClick={() => {
                    signOut({
                      redirectTo: '/',
                    });
                  }}
                >
                  Sign out
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </T>
  );
}
