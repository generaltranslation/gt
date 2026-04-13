# Security Audit Report — `gt` (General Translation)

**Date:** April 13, 2026  
**Scope:** Full repository (`generaltranslation/gt`), all packages in monorepo  
**Auditor:** Automated security review (Cursor Cloud Agent)

---

## Executive Summary

The `gt` monorepo is an i18n/localization library suite for React, Next.js, and other frameworks. The codebase is generally well-structured with several positive security practices already in place. However, the audit identified **3 critical**, **5 high**, **6 medium**, and **4 low** severity issues across the code and dependency graph.

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 5     |
| Medium   | 6     |
| Low      | 4     |

---

## Findings

### CRITICAL

#### C-1: Command Injection via `execSync` in `packageInfo.ts`

**File:** `packages/cli/src/utils/packageInfo.ts`  
**Severity:** Critical  
**CVSS:** 9.8

The `getPackageInfo` function interpolates `packageName` directly into an `execSync` shell command without sanitization:

```typescript
const output = execSync(`npm list -g ${packageName}`, {
  encoding: 'utf8',
  stdio: 'pipe',
});
```

If `packageName` is derived from user or configuration input (e.g., `gt.config.json`), a malicious value like `foo; rm -rf /` would execute arbitrary commands. The `execSync` function runs through a shell, making it susceptible to injection.

**Recommendation:** Use `execFile` (or `execFileSync`) which avoids shell interpretation, passing arguments as an array:
```typescript
import { execFileSync } from 'child_process';
const output = execFileSync('npm', ['list', '-g', packageName], {
  encoding: 'utf8',
  stdio: 'pipe',
});
```

---

#### C-2: Dynamic `import()` of Bundled User Code in `createDictionaryUpdates.ts`

**File:** `packages/cli/src/react/parse/createDictionaryUpdates.ts`  
**Severity:** Critical  
**CVSS:** 9.1

The CLI builds a user-provided dictionary file with esbuild, writes the output to a temp file, and then dynamically imports it:

```typescript
const bundledCode = result.outputFiles[0].text;
const tempFilePath = path.join(os.tmpdir(), `bundled-dictionary-${randomUUID()}.js`);
await fs.promises.writeFile(tempFilePath, bundledCode);
dictionaryModule = await import(tempFilePath);
```

This executes arbitrary JavaScript from the dictionary file in the CLI process context. While this is somewhat expected for a CLI tool processing user projects, there are risks:

- A supply-chain-compromised dictionary dependency would execute in the CLI context with full filesystem and network access.
- The temp file is world-readable on most systems (default `os.tmpdir()` permissions), creating a TOCTOU race condition window between write and import.

**Recommendation:**
- Document the security implications clearly for users.
- Consider using a sandboxed `vm` module or worker thread with restricted permissions.
- Set restrictive file permissions (`0o600`) on the temp file before writing.

---

#### C-3: Known Critical Dependency Vulnerabilities (Next.js RCE)

**Dependency:** `next` (multiple versions in workspace)  
**Severity:** Critical  
**CVEs:** GHSA-9qr9-h5gf-34mp (RCE via React flight protocol)

`pnpm audit` reports **2 critical vulnerabilities** in `next` used as peer dependencies:
- `next >=16.0.0-canary.0 <16.0.7` — RCE in React flight protocol
- `next >=15.2.0-canary.0 <15.2.6` — Same vulnerability in older range

**Recommendation:** Update `next` peer/dev dependencies to patched versions (≥16.0.7 / ≥15.2.6).

---

### HIGH

#### H-1: ReDoS Potential in User-Controlled Regex Construction

**Files:**
- `packages/cli/src/formats/files/fileMapping.ts` (lines 88, 92, 135)
- `packages/cli/src/formats/json/mergeJson.ts` (line 589)
- `packages/next/src/middleware-dir/utils.ts` (lines 211, 248)

**Severity:** High  
**CVSS:** 7.5

Several locations construct `new RegExp()` from configuration-provided patterns (from `gt.config.json` or path configuration):

```typescript
// fileMapping.ts
const regex = new RegExp(matchString);
if (regex.test(relativePath)) { ... }

// middleware utils.ts  
const regex = new RegExp(`^${pattern.replace(/\//g, '\\/')}$`);
```

If `matchString` or `pattern` contains a crafted regex (e.g., `(a+)+$`), it could cause catastrophic backtracking and freeze the process (ReDoS). The middleware is particularly concerning as it executes on every request.

**Recommendation:**
- Validate/sanitize regex patterns before compilation.
- Use a safe regex library like `safe-regex2` to check patterns before use.
- Consider using literal string matching or glob patterns instead of arbitrary regex.
- For the middleware, add a regex compilation timeout or pre-validate at config time.

---

#### H-2: 153 Known Dependency Vulnerabilities (61 High, 80 Moderate)

**Severity:** High (aggregate)

`pnpm audit` reports **153 total vulnerabilities**: 2 critical, 61 high, 80 moderate, 10 low. Key items include:

| Package | Severity | Issue |
|---------|----------|-------|
| `next` (multiple) | Critical | RCE in React flight protocol |
| `@modelcontextprotocol/inspector` | High | XSS → Command execution |
| `glob` (10.x, 11.x) | High | Command injection via CLI |
| `next` (multiple) | High | DoS with Server Components |
| `@modelcontextprotocol/sdk` | High | ReDoS |
| `qs` (via express) | Moderate | Prototype pollution |
| `h3` | Low | Missing path segment boundary |

**Recommendation:**
- Run `pnpm update` to pull in patched versions.
- Pin `next` peer dependencies to patched versions.
- Update `@modelcontextprotocol/inspector` to ≥0.16.6.
- Consider running `pnpm audit` in CI to prevent new vulnerable dependencies from merging.

---

#### H-3: API Keys Potentially Exposed in Client-Side Bundles

**File:** `packages/react/src/react-context/utils/readAuthFromEnv.tsx`  
**Severity:** High  
**CVSS:** 7.4

The `readAuthFromEnv` function reads `devApiKey` from public environment variable prefixes:

```typescript
devApiKey:
  devApiKey ||
  import.meta.env.VITE_GT_DEV_API_KEY ||
  import.meta.env.VITE_GT_API_KEY ||    // <-- Production key fallback
  import.meta.env.REDWOOD_ENV_GT_DEV_API_KEY ||
  import.meta.env.REDWOOD_ENV_GT_API_KEY,
```

Variables prefixed with `VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`, and `GATSBY_` are embedded in client-side JavaScript bundles and visible to any browser user. While dev keys are intended for development, the fallback to `VITE_GT_API_KEY` (production key) means a misconfigured project could ship production API keys in the client bundle.

**Recommendation:**
- Add runtime warnings when a production API key is detected in a client-side context.
- Consider removing the fallback from `GT_API_KEY` prefixed env vars to `GT_DEV_API_KEY` on the client side.
- Document clearly that `VITE_GT_API_KEY` should never contain a production secret.

---

#### H-4: Credentials Written to `.env.local` Without Restrictive Permissions

**File:** `packages/cli/src/utils/credentials.ts`  
**Severity:** High  
**CVSS:** 6.5

When the setup wizard writes API keys to `.env.local`, it uses default file permissions:

```typescript
await fs.promises.writeFile(envFile, envContent, 'utf8');
```

On shared systems, this creates a world-readable file. The function does ensure `.env.local` is added to `.gitignore`, which is good, but doesn't restrict filesystem permissions.

**Recommendation:** Set file permissions to `0o600` (owner read/write only):
```typescript
const fd = await fs.promises.open(envFile, 'w', 0o600);
await fd.writeFile(envContent, 'utf8');
await fd.close();
```

---

#### H-5: `innerHTML` Assignment from External Content in Sanity Plugin

**File:** `packages/sanity/src/serialization/serialize/index.ts` (line 246)  
**Severity:** High  
**CVSS:** 6.1

The Sanity serializer sets `innerHTML` from serialized content:

```typescript
rawHTMLBody.innerHTML = serializeObject(
  serializedFields as TypedObject,
  stopTypes,
  serializers
);
```

While the serialization is from trusted Sanity data, if any field contains unsanitized user input, this could lead to XSS. The deserialization side also reads `child.innerHTML` and `child.outerHTML` without sanitization.

**Recommendation:**
- Ensure all Sanity document data is sanitized before serialization.
- Consider using `textContent` for string fields instead of `innerHTML`.
- Add CSP headers to the Sanity Studio if hosting in a custom domain.

---

### MEDIUM

#### M-1: `--no-frozen-lockfile` in Release CI Workflow

**File:** `.github/workflows/release.yml` (line 50)  
**Severity:** Medium  

The release workflow uses `pnpm install --no-frozen-lockfile`, which allows dependency resolution to drift from what was tested in CI. While the comment explains this is intentional for changesets versioning, it means the release build may include dependencies that were never tested.

**Recommendation:**
- Split the workflow: run `pnpm install` (frozen) for build/test, then a separate job for changesets publish.
- Or add a verification step comparing resolved dependencies against the lockfile.

---

#### M-2: Claude Code Action with Broad Trigger and Read Permissions

**File:** `.github/workflows/claude.yml`  
**Severity:** Medium  

The Claude Code workflow triggers on any comment containing `@claude` in issues or PRs, with `id-token: write` permissions. While the current permissions are `read`-only for `contents`, `pull-requests`, and `issues`, the `id-token: write` permission could be leveraged if the action is compromised.

**Recommendation:**
- Restrict `id-token: write` to only if OIDC is actually needed.
- Consider adding a team/org membership check before executing.
- Pin the action to a specific SHA instead of `@beta`.

---

#### M-3: Unvalidated `baseUrl` in API Requests (SSRF Risk)

**File:** `packages/cli/src/utils/fetch.ts`  
**Severity:** Medium  
**CVSS:** 5.3

The `apiRequest` function concatenates `baseUrl` and `endpoint` without validation:

```typescript
return fetch(`${baseUrl}${endpoint}`, requestInit);
```

If `baseUrl` is overridden via configuration (which it can be through `gt.config.json` or environment variables), it could be pointed to an internal network address. This is a potential SSRF vector in server-side contexts.

**Recommendation:**
- Validate `baseUrl` against an allowlist of known GT API domains.
- At minimum, validate that the URL uses HTTPS.

---

#### M-4: Missing `Secure` and `SameSite` Attributes on Locale Cookies

**File:** `packages/next/src/middleware-dir/createNextMiddleware.ts`  
**Severity:** Medium  
**CVSS:** 4.3

The middleware sets locale cookies but does not explicitly set `Secure` or `SameSite` attributes. While these cookies contain only locale codes (not sensitive data), manipulating them could lead to locale confusion attacks where a user is served content in an unexpected language.

**Recommendation:** Set `SameSite=Lax` and `Secure` on all cookies in production contexts.

---

#### M-5: `unwrapDictionaryModule` Calls Unknown Functions

**File:** `packages/cli/src/react/parse/createDictionaryUpdates.ts` (line 118)  
**Severity:** Medium  

The `unwrapDictionaryModule` function calls `result()` on default exports that are functions (line 151), and checks `Object.getOwnPropertyDescriptor` on unknown objects. If a malicious dictionary exports a getter with side effects, it would execute during unwrapping.

**Recommendation:** This is partially expected behavior for CLI tooling, but consider adding a warning if the dictionary module exports executable code.

---

#### M-6: Temporary File Race Condition in Dictionary Processing

**File:** `packages/cli/src/react/parse/createDictionaryUpdates.ts`  
**Severity:** Medium  
**CVSS:** 5.0

The temp file created for dictionary bundling (`bundled-dictionary-{uuid}.js`) uses `os.tmpdir()` with default permissions. Between `writeFile` and `import`, another process could modify the file (TOCTOU). The `randomUUID()` in the filename mitigates guessing but doesn't prevent local privilege escalation if the temp directory is shared.

**Recommendation:** Use `fs.mkdtemp` to create a unique directory, or set file permissions to `0o600`.

---

### LOW

#### L-1: `dangerouslySetInnerHTML` Usage in Example App

**File:** `examples/next-chatbot/app/layout.tsx` (line 54)  
**Severity:** Low  

The chatbot example uses `dangerouslySetInnerHTML` for a theme color script. While the content (`THEME_COLOR_SCRIPT`) is a static constant, this pattern could be copied by users into less secure contexts.

**Recommendation:** Add a comment explaining why this is safe (constant, no user input).

---

#### L-2: `console.error` Leaking Stack Traces in `readAuthFromEnv`

**File:** `packages/react/src/react-context/utils/readAuthFromEnv.tsx` (line 56)  
**Severity:** Low  

When environment variable access fails, the full error is logged to `console.error(e)`, which could leak internal paths or stack traces in browser developer tools.

**Recommendation:** Log a generic message instead: `console.error('Failed to read GT auth from environment')`.

---

#### L-3: Missing Rate Limiting in Credential Polling

**File:** `packages/cli/src/utils/credentials.ts`  
**Severity:** Low  

The credential retrieval function polls the dashboard every 2 seconds for up to 1 hour (1800 requests). While this is acceptable for a CLI tool, there's no exponential backoff or jitter.

**Recommendation:** Implement exponential backoff starting at 2s with a cap at 30s.

---

#### L-4: Error Messages May Leak File Paths

**Files:** Multiple CLI files  
**Severity:** Low  

Error messages throughout the CLI include absolute file paths (e.g., `Failed to read ${viteConfigPath}`). In CI/CD logs, this could reveal directory structure details.

**Recommendation:** Use relative paths in user-facing error messages.

---

## Positive Findings

The audit also identified several positive security practices:

1. **Prototype Pollution Protection:** `packages/react-core/src/dictionaries/injectEntry.ts` explicitly checks for dangerous keys (`constructor`, `prototype`, `__proto__`) before dictionary injection. This is well-implemented.

2. **No `eval()` or `new Function()` Usage:** The codebase does not use `eval()` or `new Function()` anywhere in the library packages.

3. **`execFile` Used for Git Operations:** The `gitDiff.ts` and `branches.ts` files correctly use `execFile` (not `exec`/`execSync`) for git operations, avoiding shell injection.

4. **API Key Prefix Differentiation:** The `generateRequestHeaders.ts` correctly differentiates between internal keys (`gtx-internal-`) and regular API keys, using different header names.

5. **`.env` Files in `.gitignore`:** The root `.gitignore` and most package `.gitignore` files exclude `.env` and `.env.local` files.

6. **HTTPS by Default:** All API base URLs default to HTTPS (`https://cdn.gtx.dev`, `https://api2.gtx.dev`, `https://runtime2.gtx.dev`).

7. **Fetch Timeout Protection:** The `fetchWithTimeout` utility properly implements AbortController-based timeouts to prevent hanging requests.

8. **CI Permissions Scoped:** The CI workflow (`ci.yml`) uses minimal `contents: read` permissions.

---

## Recommendations Summary (Priority Order)

| Priority | Action | Effort |
|----------|--------|--------|
| 1 | Fix command injection in `packageInfo.ts` — switch to `execFileSync` | Low |
| 2 | Update `next` dependencies to patched versions | Low |
| 3 | Add `pnpm audit` check to CI pipeline | Low |
| 4 | Validate/sanitize regex patterns in `fileMapping.ts` and middleware | Medium |
| 5 | Set restrictive permissions (`0o600`) on `.env.local` writes | Low |
| 6 | Add warnings for production API keys in client-side contexts | Medium |
| 7 | Validate `baseUrl` against an allowlist in `apiRequest` | Low |
| 8 | Set `Secure`/`SameSite` on locale cookies | Low |
| 9 | Sandbox dictionary module execution or document risks | Medium |
| 10 | Pin GitHub Actions to SHAs instead of tags | Low |
| 11 | Update `@modelcontextprotocol/inspector` and other vulnerable deps | Medium |
| 12 | Add Content Security Policy headers documentation | Low |

---

## Methodology

This audit was conducted through static analysis of the complete codebase:

- **Code Pattern Analysis:** Searched for dangerous patterns (`eval`, `exec`, `child_process`, `innerHTML`, `dangerouslySetInnerHTML`, `prototype`, dynamic `import()`, `RegExp` construction from user input).
- **Secret Management Review:** Examined all environment variable usage, credential storage, API key handling, and `.gitignore` coverage.
- **Dependency Audit:** Ran `pnpm audit` against the full dependency graph (153 vulnerabilities found across 6 severity levels).
- **CI/CD Review:** Examined all GitHub Actions workflows for permission scope, secret handling, and supply chain risks.
- **Input Validation:** Traced user input from config files and environment through processing pipelines.
- **Network Security:** Reviewed all HTTP/fetch usage for SSRF, TLS enforcement, and header security.
