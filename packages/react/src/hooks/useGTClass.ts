import useGTContext from '../provider/GTContext';

export function useGTClass() {
  return useGTContext(
    'useGTFunctions(): Unable to access configured GT class instance outside of a <GTProvider>'
  ).gt;
}

export function useLocaleProperties(locale: string) {
  const gt = useGTClass();
  return gt.getLocaleProperties(locale);
}
