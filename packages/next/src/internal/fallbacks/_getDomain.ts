import { RequestFunctionReturnType } from '../../request/types';
import { createFallbackCustomRequestFunctionWarning } from '../../errors/ssg';

export default async function getDomain(): Promise<RequestFunctionReturnType> {
  console.warn(createFallbackCustomRequestFunctionWarning('getDomain'));
  return undefined;
}
