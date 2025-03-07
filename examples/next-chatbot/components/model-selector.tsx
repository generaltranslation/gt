'use client';

import { startTransition, useMemo, useOptimistic, useState } from 'react';

import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { CheckCircleFillIcon, ChevronDownIcon } from './icons';
import { useGT } from 'gt-next/client';

interface ChatModel {
  id: string;
  name: string;
  description: string;
}
export function ModelSelector({
  selectedModelId,
  className,
}: {
  selectedModelId: string;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);
  const t = useGT();

  const chatModels: Array<ChatModel> = useMemo(
    () => [
      {
        id: 'chat-model-small',
        name: t('Small model'),
        description: t('Small model for fast, lightweight tasks'),
      },
      {
        id: 'chat-model-large',
        name: t('Large model'),
        description: t('Large model for complex, multi-step tasks'),
      },
      {
        id: 'chat-model-reasoning',
        name: t('Reasoning model'),
        description: t('Uses advanced reasoning'),
      },
    ],
    [t]
  );

  const selectedChatModel = useMemo(
    () => chatModels.find((chatModel) => chatModel.id === optimisticModelId),
    [optimisticModelId, chatModels]
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className
        )}
      >
        <Button variant='outline' className='md:px-2 md:h-[34px]'>
          {selectedChatModel?.name}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='min-w-[300px]'>
        {chatModels.map((chatModel) => {
          const { id } = chatModel;

          return (
            <DropdownMenuItem
              key={id}
              onSelect={() => {
                setOpen(false);

                startTransition(() => {
                  setOptimisticModelId(id);
                  saveChatModelAsCookie(id);
                });
              }}
              className='gap-4 group/item flex flex-row justify-between items-center'
              data-active={id === optimisticModelId}
            >
              <div className='flex flex-col gap-1 items-start'>
                <div>{chatModel.name}</div>
                <div className='text-xs text-muted-foreground'>
                  {chatModel.description}
                </div>
              </div>

              <div className='text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100'>
                <CheckCircleFillIcon />
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
