export function getAuthHeaders(projectId: string, apiKey: string) {
  const authHeaders: Record<string, string> = {
    "x-gt-project-id": projectId,
  };
  if (apiKey) {
    authHeaders["Authorization"] = `Bearer ${apiKey}`;
  }
  return authHeaders;
}
