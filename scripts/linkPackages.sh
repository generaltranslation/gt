# Link core
cd packages/core
pnpm link
cd ../..

# Link cli
cd packages/cli
pnpm link
pnpm link generaltranslation
cd ../..

# Link supported-locales
cd packages/supported-locales
pnpm link
pnpm link generaltranslation
cd ../.. 

# Link react
cd packages/react
pnpm link
pnpm link generaltranslation
pnpm link @generaltranslation/supported-locales
cd ../..

# Link next
cd packages/next
pnpm link
pnpm link generaltranslation
pnpm link @generaltranslation/supported-locales
pnpm link gt-react
cd ../..

# Link sanity
cd packages/sanity
pnpm link
pnpm link generaltranslation
cd ../..