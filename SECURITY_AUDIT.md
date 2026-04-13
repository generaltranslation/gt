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

## User-Facing Impact Assessment

Not all findings affect your end users equally. This section separates what ships in published npm packages and runs in your users' environments from what only affects internal development.

### Published Packages and Their Runtime Context

| npm package | Runtime | What it does |
|-------------|---------|--------------|
| `generaltranslation` | Universal (browser + Node) | Core SDK — locale utilities, API client |
| `gt-react` | Browser + SSR | React bindings, `GTProvider`, env reading |
| `gt-next` | Server/Edge + browser | Next.js middleware, config, server components |
| `@generaltranslation/react-core` | Browser + SSR | Shared React core — dictionary injection, types |
| `gt-i18n` | Universal | Framework-agnostic i18n |
| `gt` (CLI) | Developer machines | CLI tool — setup wizard, code generation |
| `gt-sanity` | Sanity Studio (browser) | Sanity CMS plugin for translations |

### Findings That Directly Affect Your Users

These are vulnerabilities in code that ships in published packages and can be exploited by external attackers or cause harm in user production environments:

#### 1. Incomplete Prototype Pollution Guard in Dictionary Operations — HIGH

**Packages affected:** `@generaltranslation/react-core` (browser + SSR), consumed by `gt-react` and `gt-next`  
**Runtime:** Browser and server  
**Exploitability:** Requires attacker-controlled dictionary IDs (possible if translation keys come from external sources or a compromised translation API response)

The `injectEntry.ts` file correctly guards against dangerous keys (`__proto__`, `constructor`, `prototype`), but other code paths that use the same underlying `get`/`set` functions from `indexDict.ts` do **not** have these guards:

- `injectAndMerge.ts` — splits `id` on `.` and calls `set()` without checking for dangerous keys
- `getSubtree.ts` — splits `id` on `.` and calls `get()` without checking
- `getSubtreeWithCreation.ts` — calls `set()` to create intermediate objects without checking
- `stripMetadataFromEntries.ts` — calls `set()` without checking
- `injectHashes.ts` — calls `set()` without checking

The raw `set()` function in `indexDict.ts` does `(dictionary as any)[id as string] = value` — if `id` is `__proto__`, this pollutes `Object.prototype` for every object in the application.

**How this could be exploited:** If a compromised translation service returns dictionary entries with keys like `__proto__.isAdmin`, the prototype pollution could affect application logic. In `gt-next` server components, this runs on the server.

**Recommendation:** Move the dangerous-key check into the `get()` and `set()` functions in `indexDict.ts` so all callers are protected.

#### 2. API Key Exposure in Client-Side Bundles — HIGH

**Packages affected:** `gt-react` (browser)  
**Runtime:** Browser  
**Exploitability:** If a user misconfigures their env vars, their production API key ships in the client JS bundle

`readAuthFromEnv` falls back from `*_GT_DEV_API_KEY` to `*_GT_API_KEY` across all public-prefix env vars (`VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`, `GATSBY_`). The resolved `devApiKey` is then passed to the `GT` constructor in `ClientProvider.tsx` and sent in HTTP headers (`x-gt-api-key`) from the browser to the GT runtime API.

If a user sets `VITE_GT_API_KEY` to their production key (which the naming encourages), that key is embedded in the client bundle and visible to any visitor via browser DevTools → Network tab.

**Recommendation:** Add a runtime warning when a non-`dev` key pattern is detected in a browser context. Consider never reading `*_GT_API_KEY` (without `DEV`) from public-prefixed env vars.

#### 3. ReDoS in Next.js Middleware (Server/Edge) — HIGH

**Package affected:** `gt-next`  
**Runtime:** Edge/Server middleware — executes on every HTTP request  
**Exploitability:** Requires a developer to configure `pathConfig` with regex-like patterns containing `[^/]+`

In `packages/next/src/middleware-dir/utils.ts`, path patterns from `pathConfig` are converted to `new RegExp()` and tested against every incoming request pathname. The patterns come from user configuration, not from external attackers — so this is self-inflicted DoS rather than external exploitation. However, a malicious PR to a user's config could freeze their middleware.

**Recommendation:** Escape regex special characters or use simple string matching instead of `new RegExp()`.

#### 4. Sanity Plugin innerHTML/XSS — MEDIUM

**Package affected:** `gt-sanity`  
**Runtime:** Sanity Studio (browser, typically admin-only)  
**Exploitability:** Requires malicious content in Sanity document fields

The serializer/deserializer uses `innerHTML` and `outerHTML` to process Sanity Portable Text. If a Sanity document contains malicious HTML in translatable fields, it could execute in the Sanity Studio context of other editors. The blast radius is limited since Sanity Studio is typically admin-only, but it could enable privilege escalation within the CMS.

#### 5. Missing Cookie Security Attributes — LOW (in practice)

**Package affected:** `gt-next`  
**Runtime:** Server middleware  

Locale cookies are set without `Secure` or `SameSite` attributes. The cookies only contain locale codes (e.g., `"fr"`), not sensitive data. The practical risk is limited to locale confusion — an attacker on the same domain could manipulate which language a user sees. Not a credentials issue.

### Findings That Only Affect Developers (Not End Users)

These issues are in the CLI tool (`gt`) or in CI/CD configuration. They run only on developer machines or in GitHub Actions, not in your users' production environments:

- **C-1: Command injection in `packageInfo.ts`** — CLI-only, and `getPackageInfo` is currently only exported but not called from any code path. The function is dead code but should still be fixed.
- **C-2: Dynamic `import()` in `createDictionaryUpdates.ts`** — CLI-only. This is inherent to how build tools work (esbuild, webpack, etc. all execute user code). The TOCTOU risk with temp files is real but the threat model is the developer's own machine.
- **H-4: `.env.local` file permissions** — CLI-only (setup wizard).
- **M-1: `--no-frozen-lockfile` in release CI** — Only affects your build pipeline, not users.
- **M-2: Claude Code Action** — Only affects your GitHub repository.
- **M-3: `baseUrl` SSRF** — CLI-only. A user would have to point their own config at a malicious URL, which is self-inflicted.
- **M-5: `unwrapDictionaryModule`** — CLI-only.
- **M-6: Temp file TOCTOU** — CLI-only.
- **L-1: `dangerouslySetInnerHTML`** — Example app only, not published.
- **L-3: Credential polling** — CLI-only.
- **L-4: File path leaks** — CLI-only.

### Dependency Vulnerabilities: What Reaches Users

The 153 `pnpm audit` vulnerabilities are mostly in devDependencies, test fixtures, or example apps. What matters for published packages:

| Published package | Vulnerable transitive dep | Ships to users? |
|-------------------|--------------------------|-----------------|
| `gt-next` | `next` (peer dep) | **No** — peer deps are not bundled; users bring their own `next`. But your `peerDependencies` range may allow vulnerable versions. |
| `gt-sanity` | `glob` (via `@sanity/pkg-utils`) | Only a devDependency chain, not in published output. |
| `@generaltranslation/mcp` | `@modelcontextprotocol/inspector` | devDependency, not published. |

**Most of the 153 vulnerabilities do not reach your users.** The main action item is tightening peer dependency ranges to discourage users from running vulnerable `next` versions.

---

## All Findings (Full Detail)

### CRITICAL

#### C-1: Command Injection via `execSync` in `packageInfo.ts`

**File:** `packages/cli/src/utils/packageInfo.ts`  
**Severity:** Critical  
**User Impact:** Developer-only (CLI). Currently dead code — exported but never called.

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
**User Impact:** Developer-only (CLI). Inherent to build-tool design.

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
**User Impact:** Indirect. `next` is a peer dependency — users bring their own version. But peer dep ranges may not exclude vulnerable versions.  
**CVEs:** GHSA-9qr9-h5gf-34mp (RCE via React flight protocol)

`pnpm audit` reports **2 critical vulnerabilities** in `next` used as dev/peer dependencies:
- `next >=16.0.0-canary.0 <16.0.7` — RCE in React flight protocol
- `next >=15.2.0-canary.0 <15.2.6` — Same vulnerability in older range

**Recommendation:** Update `next` peer/dev dependencies to patched versions (≥16.0.7 / ≥15.2.6). Tighten `peerDependencies` range to exclude known-vulnerable versions.

---

### HIGH

#### H-1: Incomplete Prototype Pollution Guard in Dictionary Operations

**Files:**
- `packages/react-core/src/dictionaries/indexDict.ts` — raw `get`/`set` with no guards
- `packages/react-core/src/dictionaries/injectAndMerge.ts` — calls `set()` without key validation
- `packages/react-core/src/dictionaries/getSubtree.ts` — calls `get()` without key validation
- `packages/react-core/src/dictionaries/injectEntry.ts` — has the guard, but only in this file

**Severity:** High  
**User Impact:** Affects all users of `gt-react`, `gt-next`, `gt-i18n`. Runs in browser and server. Exploitable if translation responses are compromised or if dictionary IDs come from external input.

The `injectEntry.ts` correctly checks for `__proto__`, `constructor`, `prototype` — but the check is local to that one function. Multiple other functions (`injectAndMerge`, `getSubtree`, `getSubtreeWithCreation`, `stripMetadataFromEntries`, `injectHashes`) split IDs on `.` and pass segments directly to the unguarded `set()`/`get()` in `indexDict.ts`.

**Recommendation:** Move the dangerous-key check into `get()` and `set()` in `indexDict.ts` so that all code paths are protected.

---

#### H-2: ReDoS Potential in User-Controlled Regex Construction

**Files:**
- `packages/cli/src/formats/files/fileMapping.ts` (lines 88, 92, 135) — CLI only
- `packages/cli/src/formats/json/mergeJson.ts` (line 589) — CLI only
- `packages/next/src/middleware-dir/utils.ts` (lines 211, 248) — **ships in `gt-next`**

**Severity:** High  
**User Impact:** The middleware regex runs on every request in `gt-next` users' production servers. The CLI instances only affect developer machines.

Several locations construct `new RegExp()` from configuration-provided patterns (from `gt.config.json` or path configuration):

```typescript
// fileMapping.ts (CLI)
const regex = new RegExp(matchString);
if (regex.test(relativePath)) { ... }

// middleware utils.ts (gt-next — runs in production)
const regex = new RegExp(`^${pattern.replace(/\//g, '\\/')}$`);
```

If `matchString` or `pattern` contains a crafted regex (e.g., `(a+)+$`), it could cause catastrophic backtracking and freeze the process (ReDoS). The middleware is particularly concerning as it executes on every request.

**Recommendation:**
- Validate/sanitize regex patterns before compilation.
- Use a safe regex library like `safe-regex2` to check patterns before use.
- Consider using literal string matching or glob patterns instead of arbitrary regex.
- For the middleware, add a regex compilation timeout or pre-validate at config time.

---

#### H-3: 153 Known Dependency Vulnerabilities (61 High, 80 Moderate)

**Severity:** High (aggregate)  
**User Impact:** Mostly devDependencies. Published packages use peer dependencies for `next`, so users bring their own. See "Dependency Vulnerabilities: What Reaches Users" above.

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

#### H-4: API Keys Potentially Exposed in Client-Side Bundles

**File:** `packages/react/src/react-context/utils/readAuthFromEnv.tsx`  
**Severity:** High  
**User Impact:** Directly affects users of `gt-react` in production. A misconfigured env var could ship production API keys in the browser bundle.

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

The resolved key is used in `ClientProvider.tsx` to construct a `GT` instance, and `GT._getTranslationConfig()` sends it as `apiKey: this.apiKey || this.devApiKey`, which becomes the `x-gt-api-key` header on runtime API requests visible in the browser's network tab.

**Recommendation:**
- Add runtime warnings when a production API key is detected in a client-side context.
- Consider removing the fallback from `GT_API_KEY` prefixed env vars to `GT_DEV_API_KEY` on the client side.
- Document clearly that `VITE_GT_API_KEY` should never contain a production secret.

---

#### H-5: Credentials Written to `.env.local` Without Restrictive Permissions

**File:** `packages/cli/src/utils/credentials.ts`  
**Severity:** High  
**User Impact:** Developer-only (CLI setup wizard). Affects developers on shared machines/CI.

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

#### H-6: `innerHTML` Assignment from External Content in Sanity Plugin

**File:** `packages/sanity/src/serialization/serialize/index.ts` (line 246)  
**Severity:** High  
**User Impact:** Affects users of `gt-sanity` in their Sanity Studio (admin browser context).

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
**User Impact:** Internal only (affects what gets published to npm, but indirectly).

The release workflow uses `pnpm install --no-frozen-lockfile`, which allows dependency resolution to drift from what was tested in CI. While the comment explains this is intentional for changesets versioning, it means the release build may include dependencies that were never tested.

**Recommendation:**
- Split the workflow: run `pnpm install` (frozen) for build/test, then a separate job for changesets publish.
- Or add a verification step comparing resolved dependencies against the lockfile.

---

#### M-2: Claude Code Action with Broad Trigger and Read Permissions

**File:** `.github/workflows/claude.yml`  
**Severity:** Medium  
**User Impact:** Internal only (GitHub repo security).

The Claude Code workflow triggers on any comment containing `@claude` in issues or PRs, with `id-token: write` permissions. While the current permissions are `read`-only for `contents`, `pull-requests`, and `issues`, the `id-token: write` permission could be leveraged if the action is compromised.

**Recommendation:**
- Restrict `id-token: write` to only if OIDC is actually needed.
- Consider adding a team/org membership check before executing.
- Pin the action to a specific SHA instead of `@beta`.

---

#### M-3: Unvalidated `baseUrl` in API Requests (SSRF Risk)

**File:** `packages/cli/src/utils/fetch.ts`  
**Severity:** Medium  
**User Impact:** CLI-only (developer machines). Self-inflicted — user controls their own config.

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
**User Impact:** Affects `gt-next` users in production. Low practical risk — cookies only contain locale strings.

The middleware sets locale cookies but does not explicitly set `Secure` or `SameSite` attributes. While these cookies contain only locale codes (not sensitive data), manipulating them could lead to locale confusion attacks where a user is served content in an unexpected language.

**Recommendation:** Set `SameSite=Lax` and `Secure` on all cookies in production contexts.

---

#### M-5: `unwrapDictionaryModule` Calls Unknown Functions

**File:** `packages/cli/src/react/parse/createDictionaryUpdates.ts` (line 118)  
**Severity:** Medium  
**User Impact:** CLI-only. Inherent to build-tool design.

The `unwrapDictionaryModule` function calls `result()` on default exports that are functions (line 151), and checks `Object.getOwnPropertyDescriptor` on unknown objects. If a malicious dictionary exports a getter with side effects, it would execute during unwrapping.

**Recommendation:** This is partially expected behavior for CLI tooling, but consider adding a warning if the dictionary module exports executable code.

---

#### M-6: Temporary File Race Condition in Dictionary Processing

**File:** `packages/cli/src/react/parse/createDictionaryUpdates.ts`  
**Severity:** Medium  
**User Impact:** CLI-only. Requires local attacker on same machine.

The temp file created for dictionary bundling (`bundled-dictionary-{uuid}.js`) uses `os.tmpdir()` with default permissions. Between `writeFile` and `import`, another process could modify the file (TOCTOU). The `randomUUID()` in the filename mitigates guessing but doesn't prevent local privilege escalation if the temp directory is shared.

**Recommendation:** Use `fs.mkdtemp` to create a unique directory, or set file permissions to `0o600`.

---

### LOW

#### L-1: `dangerouslySetInnerHTML` Usage in Example App

**File:** `examples/next-chatbot/app/layout.tsx` (line 54)  
**Severity:** Low  
**User Impact:** None — example app, not published.

The chatbot example uses `dangerouslySetInnerHTML` for a theme color script. While the content (`THEME_COLOR_SCRIPT`) is a static constant, this pattern could be copied by users into less secure contexts.

**Recommendation:** Add a comment explaining why this is safe (constant, no user input).

---

#### L-2: `console.error` Leaking Stack Traces in `readAuthFromEnv`

**File:** `packages/react/src/react-context/utils/readAuthFromEnv.tsx` (line 56)  
**Severity:** Low  
**User Impact:** Minor — stack traces visible in browser DevTools of `gt-react` users.

When environment variable access fails, the full error is logged to `console.error(e)`, which could leak internal paths or stack traces in browser developer tools.

**Recommendation:** Log a generic message instead: `console.error('Failed to read GT auth from environment')`.

---

#### L-3: Missing Rate Limiting in Credential Polling

**File:** `packages/cli/src/utils/credentials.ts`  
**Severity:** Low  
**User Impact:** CLI-only.

The credential retrieval function polls the dashboard every 2 seconds for up to 1 hour (1800 requests). While this is acceptable for a CLI tool, there's no exponential backoff or jitter.

**Recommendation:** Implement exponential backoff starting at 2s with a cap at 30s.

---

#### L-4: Error Messages May Leak File Paths

**Files:** Multiple CLI files  
**Severity:** Low  
**User Impact:** CLI-only.

Error messages throughout the CLI include absolute file paths (e.g., `Failed to read ${viteConfigPath}`). In CI/CD logs, this could reveal directory structure details.

**Recommendation:** Use relative paths in user-facing error messages.

---

## Positive Findings

The audit also identified several positive security practices:

1. **Prototype Pollution Protection (partial):** `packages/react-core/src/dictionaries/injectEntry.ts` explicitly checks for dangerous keys (`constructor`, `prototype`, `__proto__`) before dictionary injection. This guard exists but needs to be applied consistently — see H-1.

2. **No `eval()` or `new Function()` Usage:** The codebase does not use `eval()` or `new Function()` anywhere in the library packages.

3. **`execFile` Used for Git Operations:** The `gitDiff.ts` and `branches.ts` files correctly use `execFile` (not `exec`/`execSync`) for git operations, avoiding shell injection.

4. **API Key Prefix Differentiation:** The `generateRequestHeaders.ts` correctly differentiates between internal keys (`gtx-internal-`) and regular API keys, using different header names.

5. **`.env` Files in `.gitignore`:** The root `.gitignore` and most package `.gitignore` files exclude `.env` and `.env.local` files.

6. **HTTPS by Default:** All API base URLs default to HTTPS (`https://cdn.gtx.dev`, `https://api2.gtx.dev`, `https://runtime2.gtx.dev`).

7. **Fetch Timeout Protection:** The `fetchWithTimeout` utility properly implements AbortController-based timeouts to prevent hanging requests.

8. **CI Permissions Scoped:** The CI workflow (`ci.yml`) uses minimal `contents: read` permissions.

---

## Recommendations Summary (Priority Order)

Prioritized by user impact — items that ship in published packages and affect production environments first:

| Priority | Action | Affects Users? | Effort |
|----------|--------|----------------|--------|
| 1 | **Fix prototype pollution**: move dangerous-key check from `injectEntry.ts` into `indexDict.ts` `get()`/`set()` | **Yes** — all `gt-react`/`gt-next` users | Low |
| 2 | **Add API key exposure warnings**: warn when non-dev key detected in browser context | **Yes** — `gt-react` users | Low |
| 3 | **Escape regex in middleware**: use `escapeStringRegexp` or literal matching in `utils.ts` | **Yes** — `gt-next` users | Low |
| 4 | **Set cookie attributes**: add `SameSite=Lax` and `Secure` to locale cookies | **Yes** — `gt-next` users | Low |
| 5 | **Tighten `next` peer dep range**: exclude known-vulnerable `next` versions | **Yes** — `gt-next` users | Low |
| 6 | Fix command injection in `packageInfo.ts` — switch to `execFileSync` | Dev-only | Low |
| 7 | Set restrictive permissions (`0o600`) on `.env.local` writes | Dev-only | Low |
| 8 | Add `pnpm audit` check to CI pipeline | Internal | Low |
| 9 | Update `@modelcontextprotocol/inspector` and other vulnerable deps | Internal | Medium |
| 10 | Pin GitHub Actions to SHAs instead of tags | Internal | Low |
| 11 | Sandbox dictionary module execution or document risks | Dev-only | Medium |
| 12 | Validate `baseUrl` against an allowlist in `apiRequest` | Dev-only | Low |

---

## Methodology

This audit was conducted through static analysis of the complete codebase:

- **Code Pattern Analysis:** Searched for dangerous patterns (`eval`, `exec`, `child_process`, `innerHTML`, `dangerouslySetInnerHTML`, `prototype`, dynamic `import()`, `RegExp` construction from user input).
- **Secret Management Review:** Examined all environment variable usage, credential storage, API key handling, and `.gitignore` coverage.
- **Dependency Audit:** Ran `pnpm audit` against the full dependency graph (153 vulnerabilities found across 6 severity levels).
- **CI/CD Review:** Examined all GitHub Actions workflows for permission scope, secret handling, and supply chain risks.
- **Input Validation:** Traced user input from config files and environment through processing pipelines.
- **Network Security:** Reviewed all HTTP/fetch usage for SSRF, TLS enforcement, and header security.
- **Published Package Analysis:** Identified which code ships in published npm tarballs vs. devDependencies/examples/tests to determine real user impact.
