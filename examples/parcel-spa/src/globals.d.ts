// Parcel resolves CSS (and other asset) imports at build time. TypeScript needs
// an ambient declaration so side-effect imports like `import './styles.css'`
// typecheck. Parcel does not ship a client types reference the way Vite does.
declare module '*.css';
