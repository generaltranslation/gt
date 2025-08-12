import { getNextRegion } from '../next/getNextRegion';
import use from '../utils/use';

let getRegionFunction: () => Promise<string | undefined>;

export async function getRegion(): Promise<string | undefined> {
  if (getRegionFunction) return await getRegionFunction();
  getRegionFunction = async () => {
    const res = await getNextRegion();
    return res;
  };
  return await getRegionFunction();
}

export function useRegion() {
  return use(getRegion());
}
