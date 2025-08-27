# PowerShell script to test builds on Windows
$ErrorActionPreference = "Stop"

Write-Output "Testing builds on Windows..."

# Test base case
Set-Location test-apps/next/base
npm install
npm run build

Write-Output "✅ Build tests completed on Windows"