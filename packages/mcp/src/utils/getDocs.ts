export const GITHUB_URL =
  'https://raw.githubusercontent.com/generaltranslation/gt/refs/heads/main/apps/docs/content/docs/en';

export const DOCS_URL = 'https://docs.generaltranslation.app';

export const getDocs = async (path: string) => {
  const url = `${GITHUB_URL}/${path}`;
  console.log(`Fetching document from: ${url}`);

  try {
    const response = await fetch(url);
    return response.text();
  } catch (error) {
    console.error(`Error fetching ${path}:`, error);
    return null;
  }
};

// Cache for storing fetched docs with expiration
interface CacheEntry {
  content: string;
  timestamp: number;
}

// Cache with 5-minute expiration
const cache: Record<string, CacheEntry> = {};
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Fetches content from the docs URL with caching
 * Refreshes cache every 5 minutes
 */
export async function fetchDocContent(path: string): Promise<string> {
  const now = Date.now();

  // Check if we have a valid cached entry
  if (cache[path] && now - cache[path].timestamp < CACHE_TTL) {
    return cache[path].content;
  }

  const url = `${DOCS_URL}/${path}`;
  console.log(`Fetching document from: ${url}`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${path}: ${response.status} ${response.statusText}`
      );
    }

    const content = await response.text();

    // Update cache
    cache[path] = {
      content,
      timestamp: now,
    };

    return content;
  } catch (error) {
    console.error(`Error fetching ${path}:`, error);

    // Return cached content if available, even if expired
    if (cache[path]) {
      console.log(`Returning stale cached content for ${path}`);
      return cache[path].content;
    }

    throw error;
  }
}
