# Link core
cd packages/core
npm link
cd ../..

# Link cli
cd packages/cli
npm link
npm link generaltranslation
cd ../..

# Link supported-locales
cd packages/supported-locales
npm link
npm link generaltranslation
cd ../.. 

# Link react
cd packages/react
npm link
npm link generaltranslation
npm link @generaltranslation/supported-locales
cd ../..

# Link next
cd packages/next
npm link
npm link generaltranslation
npm link @generaltranslation/supported-locales
npm link gt-react
cd ../..
