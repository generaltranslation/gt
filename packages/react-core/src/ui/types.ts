import type { CustomMapping } from '@generaltranslation/format/types';
import { ReactNode } from 'react';

export type LocaleSelectorProps = {
  locales?: string[];
  customNames?: { [key: string]: string };
  customMapping?: CustomMapping;
  [key: string]: unknown;
};

export type RegionSelectorProps<Regions extends string[]> = {
  regions?: Regions;
  placeholder?: ReactNode;
  customMapping?: CustomMapping;
  prioritizeCurrentLocaleRegion?: boolean;
  sortRegionsAlphabetically?: boolean;
};
