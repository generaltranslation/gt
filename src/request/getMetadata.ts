import { getNextDomain } from "../next/getNextDomain";

let getMetadataFunction: () => Promise<Record<string, any>>;

export default async function getMetadata(): Promise<Record<string, any>> {
    if (getMetadataFunction) return await getMetadataFunction();
    try {
        const customRequestConfig = require('gt-next/_request');
        const customGetMetadata = customRequestConfig?.default?.getMetadata || customRequestConfig.getMetadata;
        const metadata = await customGetMetadata();
        getMetadataFunction = await customGetMetadata();
        return metadata;
    } catch {
        getMetadataFunction = async () => ({
            domain: await getNextDomain()
        });
        return getMetadataFunction();
    };
        
}
