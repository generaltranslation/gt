// ========== Translation Data Types ========== //
// TODO: reduce duplication between this file and the Translations type in packages/react-core/src/utils/types.ts

import type { Content } from '@generaltranslation/format/types';
import type { MessageTree } from '@generaltranslation/icu';

/**
 * A single catalog entry: string or JSX content, or a message tree stored
 * under a message tree hash by `gt-i18n/unstable`.
 */
export type Translation = Content | MessageTree;
