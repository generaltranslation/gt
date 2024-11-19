import { extractEntryMetadata, getDictionaryEntry } from "gt-react/internal";
import T from "./inline/T";
import getDictionary from "../dictionary/getDictionary";
import tx from "./strings/tx";

export default function createServerTFunction( 
    prefixID?: string
) {
    
    const getID = (id: string) => {
        return prefixID ? `${prefixID}.${id}` : id;
    }

    const dictionary = getDictionary();
    
    return (
        id: string, 
        options?: Record<string, any>,
        f?: Function
    ): JSX.Element | string | Promise<JSX.Element | string> | undefined => {

        id = getID(id);

        // Get entry
        let { entry, metadata } = extractEntryMetadata(
            getDictionaryEntry(dictionary, id)
        );

        // Get variables and variable options
        let variables; let variablesOptions;
        if (options) {
            variables = options;
            if (metadata?.variablesOptions) {
                variablesOptions = metadata.variablesOptions;
            }
        }

        // Handle if the entry is a function
        if (typeof f === 'function') {
            entry = f(options);
        } else if (typeof entry === 'function') {
            entry = entry(options);
        }

        if (!entry) {
            console.warn(`No entry found for id: "${id}"`);
            return undefined;
        }

        if (typeof entry === 'string') {
            return tx(entry, { 
                id 
            }, variables, variablesOptions);
        }

        return (
            <T 
                id={id}
                variables={variables}
                variablesOptions={variablesOptions}
                {...metadata}
            >
                {entry}
            </T>
        )

    }

}