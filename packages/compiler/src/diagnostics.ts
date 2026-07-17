import {
  createDiagnosticMessage,
  type DiagnosticMessageInput,
} from 'generaltranslation/internal';
import type { ModuleFormatDetection } from './compatibility/devHotReload';

type CompilerDiagnosticInput = Omit<DiagnosticMessageInput, 'source'>;

function createCompilerDiagnostic(input: CompilerDiagnosticInput): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    ...input,
  });
}

export function createDevHotReloadModuleFormatWarning(
  detection: ModuleFormatDetection
): string {
  const detectedFormat =
    detection.format === 'cjs' ? 'CommonJS (CJS)' : 'an unknown module format';

  return createCompilerDiagnostic({
    severity: 'Warning',
    whatHappened: `Development hot reload is enabled while the compiler detected ${detectedFormat}`,
    reassurance:
      'The compiler will continue and inject the configured development hot reload calls.',
    why: 'development hot reload uses top-level await, which requires ESM and ES2022-or-newer runtime support',
    fix: 'Use ES2022-or-newer ESM',
    wayOut: 'disable devHotReload in gt.config.json',
    details: `Module format detection: ${detection.detail}`,
    docsUrl:
      'https://generaltranslation.com/en/docs/react/guides/developing-spa-translations',
  });
}
