export function getAuthHeaders(projectId: string, apiKey: string) {
  const authHeaders: Record<string, string> = {
    'x-gt-project-id': projectId,
  };
  if (apiKey) {
    if (apiKey.startsWith('gtx-internal-')) {
      authHeaders['x-gt-internal-api-key'] = apiKey;
    } else {
      authHeaders['x-gt-api-key'] = apiKey;
    }
  }
  return authHeaders;
}
