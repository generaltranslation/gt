import { isToolUIPart, type UIMessage } from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Message as DBMessage, Document } from '@/lib/db/schema';

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error(
      'An error occurred while fetching the data.'
    ) as ApplicationError;

    error.info = await res.json();
    error.status = res.status;

    throw error;
  }

  return res.json();
};

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Messages saved by earlier versions of this app (ai v4) stored model message
// content. Keep only the parts that are valid UI message parts.
function isUIMessagePart(part: unknown): part is UIMessage['parts'][number] {
  if (!part || typeof part !== 'object' || !('type' in part)) return false;

  const { type } = part as { type: unknown };

  if (typeof type !== 'string') return false;
  if (type === 'text' || type === 'reasoning') return 'text' in part;
  if (type === 'file') return 'url' in part;
  if (type === 'step-start') return true;
  if (type.startsWith('tool-') || type.startsWith('data-')) {
    return 'state' in part || 'data' in part;
  }

  return false;
}

export function convertToUIMessages(
  messages: Array<DBMessage>
): Array<UIMessage> {
  return messages
    .filter((message) => message.role !== 'tool')
    .map((message) => ({
      id: message.id,
      role: message.role as UIMessage['role'],
      parts:
        typeof message.content === 'string'
          ? [{ type: 'text', text: message.content }]
          : Array.isArray(message.content)
            ? message.content.filter(isUIMessagePart)
            : [],
    }));
}

export function sanitizeUIMessages(
  messages: Array<UIMessage>
): Array<UIMessage> {
  const messagesBySanitizedToolParts = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    const sanitizedParts = message.parts.filter(
      (part) => !isToolUIPart(part) || part.state === 'output-available'
    );

    return {
      ...message,
      parts: sanitizedParts,
    };
  });

  return messagesBySanitizedToolParts.filter(
    (message) => message.parts.length > 0
  );
}

export function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function getMostRecentUserMessage(messages: Array<UIMessage>) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Array<Document>,
  index: number
) {
  if (!documents) return new Date();
  if (index > documents.length) return new Date();

  return documents[index].createdAt;
}
