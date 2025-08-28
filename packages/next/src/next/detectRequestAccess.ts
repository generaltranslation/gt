/**
 * Checks if we have access to Next.js request headers and cookies.
 * Returns false during static generation when these APIs are not available.
 */
export async function hasRequestAccess(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    return false; // Client-side, no access to server request
  }

  try {
    const { headers, cookies } = await import('next/headers');

    // Try to access both headers and cookies
    await headers();
    await cookies();

    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronous version that checks if the headers/cookies modules are accessible.
 * Note: This doesn't guarantee they won't throw when called.
 */
export function canAccessRequestAPIs(): boolean {
  if (typeof window !== 'undefined') {
    return false;
  }

  try {
    require.resolve('next/headers');
    return true;
  } catch {
    return false;
  }
}
