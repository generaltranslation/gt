# PowerShell script to link packages on Windows
$ErrorActionPreference = "Stop"

Write-Output "Linking packages on Windows..."


# Link cli to core
Set-Location packages/cli
pnpm link ../core
Set-Location ../..

# Link supported-locales to core
Set-Location packages/supported-locales
pnpm link ../core
Set-Location ../..

# Link react to core and supported-locales
Set-Location packages/react
pnpm link ../core
pnpm link ../supported-locales
Set-Location ../..

# Link next to core, supported-locales, and react
Set-Location packages/next
pnpm link ../core
pnpm link ../supported-locales
pnpm link ../react
Set-Location ../..

Write-Output "✅ Package linking completed on Windows"