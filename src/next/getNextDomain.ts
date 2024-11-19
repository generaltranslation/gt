import { headers } from "next/headers";

/**
 * Retrieves the 'host' header from the headers list.
 * If the 'next/headers' module is not available, it attempts to load it. If the
 * headers function is available, it returns the value of the 'host' header.
 * If the headers function or 'host' header is not available, returns null.
 *
 * @returns {string | null} A promise that resolves to the value of the 'host' header,
 * or null if not available.
 */
export async function getNextDomain(): Promise<string | null> {
    const headerList = await headers();
    return headerList.get('host') || null;
}