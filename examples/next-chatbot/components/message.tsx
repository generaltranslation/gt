'use client';

import { getToolName, isToolUIPart, type UIMessage } from 'ai';
import type { UseChatHelpers } from '@ai-sdk/react';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState } from 'react';

import type { Vote } from '@/lib/db/schema';

import { DocumentToolCall, DocumentToolResult } from './document';
import { PencilEditIcon, SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather, type WeatherAtLocation } from './weather';
import equal from 'fast-deep-equal';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import {
  DocumentPreview,
  type DocumentPreviewArgs,
  type DocumentPreviewResult,
} from './document-preview';
import { MessageReasoning } from './message-reasoning';
import { T } from 'gt-next';

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
}: {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
  reload: UseChatHelpers<UIMessage>['regenerate'];
  isReadonly: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === 'file'
  );

  return (
    <AnimatePresence>
      <motion.div
        className='w-full mx-auto max-w-3xl px-4 group/message'
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            }
          )}
        >
          {message.role === 'assistant' && (
            <div className='size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background'>
              <div className='translate-y-px'>
                <SparklesIcon size={14} />
              </div>
            </div>
          )}

          <div className='flex flex-col gap-4 w-full'>
            {attachmentsFromMessage.length > 0 && (
              <div className='flex flex-row justify-end gap-2'>
                {attachmentsFromMessage.map((attachment) => (
                  <PreviewAttachment
                    key={attachment.url}
                    attachment={{
                      name: attachment.filename ?? 'file',
                      contentType: attachment.mediaType,
                      url: attachment.url,
                    }}
                  />
                ))}
              </div>
            )}

            {message.parts.map((part, index) => {
              const key = `message-${message.id}-part-${index}`;

              if (part.type === 'reasoning') {
                return (
                  <MessageReasoning
                    key={key}
                    isLoading={isLoading}
                    reasoning={part.text}
                  />
                );
              }

              if (part.type === 'text' && mode === 'view') {
                return (
                  <div key={key} className='flex flex-row gap-2 items-start'>
                    {message.role === 'user' && !isReadonly && (
                      <T id='components.message.0'>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant='ghost'
                              className='px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100'
                              onClick={() => {
                                setMode('edit');
                              }}
                            >
                              <PencilEditIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit message</TooltipContent>
                        </Tooltip>
                      </T>
                    )}

                    <div
                      className={cn('flex flex-col gap-4', {
                        'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                          message.role === 'user',
                      })}
                    >
                      <Markdown>{part.text}</Markdown>
                    </div>
                  </div>
                );
              }

              if (part.type === 'text' && mode === 'edit') {
                return (
                  <div key={key} className='flex flex-row gap-2 items-start'>
                    <div className='size-8' />

                    <MessageEditor
                      key={message.id}
                      message={message}
                      setMode={setMode}
                      setMessages={setMessages}
                      reload={reload}
                    />
                  </div>
                );
              }

              if (isToolUIPart(part)) {
                const toolName = getToolName(part);
                const { toolCallId, state } = part;

                if (state === 'output-available') {
                  const result = part.output;

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getWeather' ? (
                        <Weather
                          weatherAtLocation={result as WeatherAtLocation}
                        />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview
                          isReadonly={isReadonly}
                          result={result as DocumentPreviewResult}
                        />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolResult
                          type='update'
                          result={result as DocumentPreviewResult}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolResult
                          type='request-suggestions'
                          result={result as DocumentPreviewResult}
                          isReadonly={isReadonly}
                        />
                      ) : (
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      )}
                    </div>
                  );
                }

                const args = (part.input ?? {}) as DocumentPreviewArgs;

                return (
                  <div
                    key={toolCallId}
                    className={cx({
                      skeleton: ['getWeather'].includes(toolName),
                    })}
                  >
                    {toolName === 'getWeather' ? (
                      <Weather />
                    ) : toolName === 'createDocument' ? (
                      <DocumentPreview isReadonly={isReadonly} args={args} />
                    ) : toolName === 'updateDocument' ? (
                      <DocumentToolCall
                        type='update'
                        args={args}
                        isReadonly={isReadonly}
                      />
                    ) : toolName === 'requestSuggestions' ? (
                      <DocumentToolCall
                        type='request-suggestions'
                        args={args}
                        isReadonly={isReadonly}
                      />
                    ) : null}
                  </div>
                );
              }

              return null;
            })}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  }
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <T id='components.message.1'>
      <motion.div
        className='w-full mx-auto max-w-3xl px-4 group/message '
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
        data-role={role}
      >
        <div
          className={cx(
            'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
            {
              'group-data-[role=user]/message:bg-muted': true,
            }
          )}
        >
          <div className='size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border'>
            <SparklesIcon size={14} />
          </div>

          <div className='flex flex-col gap-2 w-full'>
            <div className='flex flex-col gap-4 text-muted-foreground'>
              Thinking...
            </div>
          </div>
        </div>
      </motion.div>
    </T>
  );
};
