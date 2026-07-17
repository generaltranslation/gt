import {
  createDiagnosticMessage,
  type DiagnosticMessageInput,
} from 'generaltranslation/internal';
import type { DevHotReloadModuleCompatibility } from './compatibility/devHotReload';

type CompilerDiagnosticInput = Omit<DiagnosticMessageInput, 'source'>;

function createCompilerDiagnostic(input: CompilerDiagnosticInput): string {
  return createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    ...input,
  });
}

export function createIncompatibleDevHotReloadWarning(
  compatibility: Exclude<DevHotReloadModuleCompatibility, { compatible: true }>
): string {
  return createCompilerDiagnostic({
    severity: 'Warning',
    whatHappened:
      'Module-level development hot reload was disabled for an incompatible module format',
    reassurance:
      'Production translations and the rest of the compilation continue normally.',
    why: 'development hot reload injects top-level await, which requires ES2022 modules',
    fix: 'Compile the application as ES2022 or ESNext ESM',
    details: `Detected module type: ${compatibility.detectedModuleType}`,
    docsUrl:
      'https://generaltranslation.com/en/docs/react/guides/developing-spa-translations',
  });
}
