import { decode, encode } from 'generaltranslation/internal';

export function attachGTData(
  html: string,
  data: Record<string, unknown>,
  type: 'markDef'
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
  data?: Record<'markDef', Record<string, unknown>>;
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

  let extractedData: Record<'markDef', Record<string, unknown>> | undefined;
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
