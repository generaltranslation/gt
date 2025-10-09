import withGTConfigProps from './props/withGTConfigProps';
import { babelPluginCompatible } from '../plugin/getStableNextVersionInfo';
import { createGTCompilerUnavailableWarning } from '../errors/createErrors';
import { swcPluginCompatible } from '../plugin/getStableNextVersionInfo';

/**
 * Validate the compiler options
 * @param mergedConfig - The merged config
 * @description If the compiler is not compatible, set the type to 'none'
 */
export function validateCompiler(mergedConfig: withGTConfigProps) {
  const turboPackEnabled = process.env.TURBOPACK === '1';
  if (!mergedConfig.experimentalCompilerOptions) return;
  const type = mergedConfig.experimentalCompilerOptions.type;
  if (type === 'swc' && !swcPluginCompatible) {
    console.warn(createGTCompilerUnavailableWarning('swc'));
    mergedConfig.experimentalCompilerOptions.type = 'none';
  } else if (type === 'babel' && (!babelPluginCompatible || turboPackEnabled)) {
    console.warn(createGTCompilerUnavailableWarning('babel'));
    mergedConfig.experimentalCompilerOptions.type = 'none';
  }
}
