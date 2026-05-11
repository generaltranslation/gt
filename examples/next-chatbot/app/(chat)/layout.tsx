import { cookies } from 'next/headers';
import Script, { type ScriptProps } from 'next/script';
import type { ComponentType } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import { auth } from '../(auth)/auth';

export const experimental_ppr = true;

type ScriptWithSrcProps = ScriptProps & {
  src: string;
};

const ScriptWithSrc = Script as ComponentType<ScriptWithSrcProps>;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get('sidebar:state')?.value !== 'true';

  return (
    <>
      <ScriptWithSrc
        src='https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js'
        strategy='beforeInteractive'
      />
      <SidebarProvider defaultOpen={!isCollapsed}>
        <AppSidebar user={session?.user} />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </>
  );
}
