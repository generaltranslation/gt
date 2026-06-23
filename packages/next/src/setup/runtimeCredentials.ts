export function getRuntimeCredentials() {
  return {
    projectId:
      process.env.NEXT_PUBLIC_GT_PROJECT_ID || process.env.GT_PROJECT_ID,
    apiKey: process.env.GT_API_KEY,
    devApiKey:
      process.env.NEXT_PUBLIC_GT_DEV_API_KEY || process.env.GT_DEV_API_KEY,
  };
}
