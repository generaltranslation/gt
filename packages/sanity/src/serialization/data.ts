export function attachGTData(
  html: string,
  data: Record<string, any>,
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
  data?: Record<'markDef', Record<string, any>>;
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

  let extractedData: Record<'markDef', Record<string, any>> | undefined;
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

// Encode a string to base64
export function encode(data: string): string {
  // Browser path
  const bytes = new TextEncoder().encode(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Decode a base64 string to a string
export function decode(base64: string): string {
  // Browser path
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}
