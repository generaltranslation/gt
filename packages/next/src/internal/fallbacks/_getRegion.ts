// Fallback when SSG enabled to skip next/headers import
import { RequestFunctionReturnType } from '../../request/types';
import { createFallbackCustomRequestFunctionWarning } from '../../errors/ssg';

export default async function getRegion(): Promise<RequestFunctionReturnType> {
  console.warn(createFallbackCustomRequestFunctionWarning('getRegion'));
  return '';
}
