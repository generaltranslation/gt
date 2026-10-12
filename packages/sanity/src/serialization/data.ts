import { decode, encode } from 'generaltranslation/internal';

/**
 * Kinds of Sanity data that can be carried on an element:
 * - `markDef`: an annotation (e.g. a link) applied to the element's children
 * - `inlineObject`: an inline object in a block's `children`, restored as-is
 */
export type GTDataType = 'markDef' | 'inlineObject';

export type GTData = Partial<Record<GTDataType, Record<string, unknown>>>;

export function attachGTData(
  html: string,
  data: Record<string, unknown>,
  type: GTDataType
): string {
  // Parse the HTML string to find the first element
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const firstElement = doc.body.firstElementChild;

  if (!firstElement) {
    // If no element found, return original HTML
    return html;
  }

  // Encode the data as base64 JSON
  const encodedData = encode(JSON.stringify({ [type]: data }));

  // Add the data-gt-internal attribute
  firstElement.setAttribute('data-gt-internal', encodedData);

  return firstElement.outerHTML;
}

export function detachGTData(html: string): {
  html: string;
  data?: GTData;
} {
  // Parse the HTML string to find the first element
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const firstElement = doc.body.firstElementChild;

  if (!firstElement) {
    // If no element found, return original HTML with no data
    return { html };
  }

  // Get the encoded data
  const encodedData = firstElement.getAttribute('data-gt-internal');

  let extractedData: GTData | undefined;
  if (encodedData) {
    try {
      // Decode and parse the data
      const decodedData = decode(encodedData);
      extractedData = JSON.parse(decodedData);

      // Remove the data attribute to clean up the HTML
      firstElement.removeAttribute('data-gt-internal');
    } catch (error) {
      console.warn('Failed to decode GT internal data:', error);
    }
  }

  return {
    html: firstElement.outerHTML,
    data: extractedData,
  };
}
