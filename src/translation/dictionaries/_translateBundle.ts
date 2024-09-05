import { Request } from '../../types/types'

/**
 * Bundles multiple requests and sends them to the server.
 * @param {{ baseURL: string, apiKey: string }} gt - Contains the baseURL and apiKey for the server request.
 * @param {Request[]} requests - Array of requests to be processed and sent.
 * @param {{ timeout?: number }} options - Additional options for the request, including timeout.
 * @returns {Promise<Array<any | null>>} A promise that resolves to an array of processed results.
 * @internal
 */
export default async function _translateBundle(
    gt: { baseURL: string, apiKey: string },
    requests: Request[]
): Promise<Array<any | null>> {
    const controller = new AbortController();
    const signal = controller.signal;

    if (requests[0]?.data?.metadata?.timeout) {
        setTimeout(() => controller.abort(), requests[0].data.metadata.timeout);
    }

    try {
        const response = await fetch(`${gt.baseURL}/bundle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'gtx-api-key': gt.apiKey,
            },
            body: JSON.stringify(requests),
            signal
        });
        if (!response.ok) {
            throw new Error(`${response.status}: ${await response.text()}`);
        }
        const resultArray = await response.json();
        return resultArray;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Error: Request timed out.');
        }
        throw new Error(`${error}`);
    }
}