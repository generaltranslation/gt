import React from "react";
import { createLibraryNoEntryWarning } from "../../messages/createMessages";
export default function getDictionaryEntry(dictionary, id) {
    let current = dictionary;
    let dictionaryPath = id.split(".");
    for (const key of dictionaryPath) {
        if (typeof current !== "object" ||
            Array.isArray(current) ||
            React.isValidElement(current)) {
            console.error(createLibraryNoEntryWarning(id));
            return undefined;
        }
        current = current[key];
    }
    return current;
}
