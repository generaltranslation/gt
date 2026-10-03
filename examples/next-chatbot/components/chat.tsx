'use client';

import { DefaultChatTransport, type UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { type Attachment, fetcher, generateUUID } from '@/lib/utils';

import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { VisibilityType } from './visibility-selector';
import { DataStreamHandler, type DataStreamDelta } from './data-stream-handler';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';
import { useGT } from 'gt-next';

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();
  const t = useGT();

  const [input, setInput] = useState('');
  const [dataStream, setDataStream] = useState<Array<DataStreamDelta>>([]);

  const {
    messages,
    setMessages,
    sendMessage: append,
    status,
    stop,
    regenerate: reload,
  } = useChat({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { selectedChatModel },
    }),
    onData: (dataPart) => {
      setDataStream((currentDataStream) => [
        ...currentDataStream,
        {
          type: dataPart.type.slice('data-'.length),
          content: dataPart.data,
        } as DataStreamDelta,
      ]);
    },
    onFinish: () => {
      mutate('/api/history');
    },
    onError: () => {
      toast.error(t('An error occured, please try again!'));
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const { data: votes } = useSWR<Array<Vote>>(
    `/api/vote?chatId=${id}`,
    fetcher
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  return (
    <>
      <div className='flex flex-col min-w-0 h-dvh bg-background'>
        <ChatHeader
          chatId={id}
          selectedModelId={selectedChatModel}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
        />

        <Messages
          chatId={id}
          isLoading={isLoading}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <form className='flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl'>
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              isLoading={isLoading}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
      />

      <DataStreamHandler dataStream={dataStream} />
    </>
  );
}
