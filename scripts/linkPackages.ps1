# PowerShell script to link packages on Windows
$ErrorActionPreference = "Stop"

Write-Output "Linking packages on Windows..."

# Link core
Set-Location packages/core
npm link
Set-Location ../..

# Link cli
Set-Location packages/cli
npm link
npm link generaltranslation
Set-Location ../..

# Link supported-locales
Set-Location packages/supported-locales
npm link
npm link generaltranslation
Set-Location ../..

# Link react
Set-Location packages/react
npm link
npm link generaltranslation
npm link "@generaltranslation/supported-locales"
Set-Location ../..

# Link next
Set-Location packages/next
npm link
npm link generaltranslation
npm link "@generaltranslation/supported-locales"
npm link gt-react
Set-Location ../..

Write-Output "✅ Package linking completed on Windows"