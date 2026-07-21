import type { ReactInitializeGTParams } from '@generaltranslation/react-core/pure';

export type InitializeGTParams = ReactInitializeGTParams;

// Server-render initialization is identical to react-core's shared implementation
// (there is no native-specific setup here), so re-export it directly instead of
// maintaining a byte-for-byte copy.
export { internalInitializeGTSRA as initializeGT } from '@generaltranslation/react-core/pure';
