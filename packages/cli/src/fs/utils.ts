export function resolveProjectId(): string | undefined {
  const CANDIDATES = [
    process.env.GT_PROJECT_ID, // any server side, Remix
    process.env.NEXT_PUBLIC_GT_PROJECT_ID, // Next.js
    process.env.VITE_GT_PROJECT_ID, // Vite
    process.env.REACT_APP_GT_PROJECT_ID, // Create React App
    process.env.REDWOOD_ENV_GT_PROJECT_ID, // RedwoodJS
    process.env.GATSBY_GT_PROJECT_ID, // Gatsby
    process.env.EXPO_PUBLIC_GT_PROJECT_ID, // Expo (React Native)
    process.env.RAZZLE_GT_PROJECT_ID, // Razzle
    process.env.UMI_GT_PROJECT_ID, // UmiJS
    process.env.BLITZ_PUBLIC_GT_PROJECT_ID, // Blitz.js
    process.env.PUBLIC_GT_PROJECT_ID, // WMR, Qwik (general "public" convention)
  ];
  return CANDIDATES.find((projectId) => projectId !== undefined);
}
