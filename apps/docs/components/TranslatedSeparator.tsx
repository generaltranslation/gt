'use client';
import { useTranslations } from 'gt-next/client';
import { SidebarSeparator } from 'fumadocs-ui/components/layout/sidebar';
import { ReactNode, ReactElement } from 'react';

const sectionHeaderMap: Record<string, string> = {
  'Getting Started': 'gettingStarted',
  'Advanced': 'advanced',
  'Guides': 'guides',
  'Technical Concepts': 'technicalConcepts',
  'API': 'api',
  'Tutorials': 'tutorials',
  'Features': 'features',
  'Platform': 'platform',
  'Reference': 'reference',
  'Client': 'client',
  'Server': 'server',
  'Commands': 'commands',
  'Supported Formats': 'supportedFormats'
};

interface TranslatedSeparatorProps {
  item: {
    name?: ReactNode;
    icon?: ReactElement;
  };
}

export function TranslatedSeparator({ item }: TranslatedSeparatorProps) {
  const d = useTranslations();
  
  // Convert ReactNode to string for lookup, only if it's actually a string
  const nameAsString = typeof item.name === 'string' ? item.name : undefined;
  const translationKey = nameAsString ? sectionHeaderMap[nameAsString] : undefined;
  const translatedText = translationKey ? d(translationKey) : item.name;
  
  return (
    <SidebarSeparator className="mt-6 first:mt-0">
      {item.icon}
      {translatedText}
    </SidebarSeparator>
  );
}