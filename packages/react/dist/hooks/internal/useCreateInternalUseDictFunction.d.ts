import { Dictionary, DictionaryTranslationOptions, InlineTranslationOptions } from '../../types/types';
export default function useCreateInternalUseDictFunction({ dictionary, _internalUseGTFunction }: {
    dictionary: Dictionary;
    _internalUseGTFunction: (string: string, options?: InlineTranslationOptions) => string;
}): (id: string, options?: DictionaryTranslationOptions) => string;
//# sourceMappingURL=useCreateInternalUseDictFunction.d.ts.map