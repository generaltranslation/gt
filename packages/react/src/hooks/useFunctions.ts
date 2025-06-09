import useGTContext from "../provider/GTContext";

export function useGTFunctions() {
    return useGTContext(
        'useGTFunctions(): Unable to access configured GT class instance outside of a <GTProvider>'
    ).gt;
}

export function useLocaleProperties(locale: string) {
    const { getLocaleProperties } = useGTFunctions();
    return getLocaleProperties(locale);
}
  