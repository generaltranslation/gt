---
'@generaltranslation/compiler': patch
---

Warn when a file's JSX is compiled against a JSX runtime other than React's. The compiler reads compiled JSX only when its calls are imported from `react/jsx-runtime` or `react/jsx-dev-runtime`, so in an app whose JSX transform is given another import source it inserted no `<T>`, computed no hash and checked no usage, without saying so. A build now warns once for each such source, when a file that imports from a General Translation package, or any file of a build with `enableAutoJsxInjection`, is compiled against it. The warning names the source and the first file. Nothing else changes: the files are skipped as before, and builds on React's runtime are the same. To have the compiler read such an app, compile its JSX against React's runtime, so that its files import `react/jsx-runtime` and `react/jsx-dev-runtime`, and resolve those two modules to the other runtime in the bundler.
