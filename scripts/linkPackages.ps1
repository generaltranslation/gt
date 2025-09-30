# PowerShell script to link packages on Windows
$ErrorActionPreference = "Stop"

Write-Output "Linking packages on Windows..."


# Link packages to test-apps/next/base
Set-Location test-apps/next/base
pnpm link ..\..\..\packages\next
pnpm link ..\..\..\packages\react
pnpm link ..\..\..\packages\core
pnpm link ..\..\..\packages\supported-locales
Set-Location ../../..

# Link packages to test-apps/next/general-cases
Set-Location test-apps/next/general-cases
pnpm link ..\..\..\packages\next
pnpm link ..\..\..\packages\react
pnpm link ..\..\..\packages\core
pnpm link ..\..\..\packages\supported-locales
Set-Location ../../..

Write-Output "✅ Package linking completed on Windows"