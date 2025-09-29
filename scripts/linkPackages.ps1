# PowerShell script to link packages on Windows
$ErrorActionPreference = "Stop"

Write-Output "Linking packages on Windows..."

# Link core
Set-Location packages/core
pnpm link
Set-Location ../..

# Link cli
Set-Location packages/cli
pnpm link
pnpm link generaltranslation
Set-Location ../..

# Link supported-locales
Set-Location packages/supported-locales
pnpm link
pnpm link generaltranslation
Set-Location ../..

# Link react
Set-Location packages/react
pnpm link
pnpm link generaltranslation
pnpm link "@generaltranslation/supported-locales"
Set-Location ../..

# Link next
Set-Location packages/next
pnpm link
pnpm link generaltranslation
pnpm link "@generaltranslation/supported-locales"
pnpm link gt-react
Set-Location ../..

Write-Output "✅ Package linking completed on Windows"