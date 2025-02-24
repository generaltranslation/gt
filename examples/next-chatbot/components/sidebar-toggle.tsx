import type { ComponentProps } from 'react';

import { type SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { SidebarLeftIcon } from './icons';
import { Button } from './ui/button';
import { T } from 'gt-next';

export function SidebarToggle({
  className,
}: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar } = useSidebar();

  return (
    <T id="components.sidebar_toggle.0">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={toggleSidebar}
            variant="outline"
            className="md:px-2 md:h-fit"
          >
            <SidebarLeftIcon size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent align="start">Toggle Sidebar</TooltipContent>
      </Tooltip>
    </T>
  );
}
