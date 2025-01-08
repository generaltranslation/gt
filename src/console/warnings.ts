export const warnApiKeyInConfig = (optionsFilepath: string) => {
    console.warn(`WARNING: Found apiKey in "${optionsFilepath}". Are you sure you want to do this? Make sure your API key is not accidentally exposed, e.g. by putting ${optionsFilepath} in .gitignore.\n`)
}

export const warnVariableProp = (file: string, attrName: string, value: string) => {
    console.warn(
        `WARNING: Found <T> component in ${file} with variable ${attrName}: "${value}". Change "${attrName}" to ensure this content is translated.\n`
    );
}

export const warnNoId = (file: string) => {
    console.warn(
        `WARNING: Found <T> component in ${file} with no id. Add an id to ensure the content is translated.\n`
    );
}

export const warnHasUnwrappedExpression = (file: string, id: string) => {
    console.warn(
        `WARNING: <T id="${id}"> in ${file} has children that could change at runtime. Use a variable component like <Var> (https://generaltranslation.com/docs) to translate this properly.\n` 
    );
}