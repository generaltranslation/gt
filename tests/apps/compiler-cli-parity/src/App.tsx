import React from 'react';

// Auto-import all test cases — Vite expands this to static imports at build time
const modules = import.meta.glob('./cases/*/index.tsx', { eager: true }) as Record<
  string,
  { default: React.ComponentType }
>;

const cases = Object.entries(modules).map(([path, mod]) => ({
  name: path.replace('./cases/', '').replace('/index.tsx', ''),
  Component: mod.default,
}));

export default function App() {
  return (
    <div>
      {cases.map(({ name, Component }) => (
        <div key={name} data-testcase={name}>
          <Component />
        </div>
      ))}
    </div>
  );
}
