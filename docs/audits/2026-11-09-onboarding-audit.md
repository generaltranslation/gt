# General Translation onboarding audit

**Tested:** November 9, 2026 (Pacific Time)  
**Environment:** Fresh Chromium sessions on Linux; desktop and approximately 390 × 844 narrow viewport  
**Persona:** New developer evaluating General Translation without payment details or an existing GitHub connection

## Executive summary

The onboarding path is usable from the marketing site through a real CLI translation run without adding a payment method. I created synthetic accounts with disposable inboxes, completed the four-step onboarding wizard, generated a project API key, integrated a disposable Next.js app, translated three strings into Spanish and French, and confirmed the translations in the dashboard.

No launch-blocking failure was found. The highest-value fixes are clearer CAPTCHA gating on sign-in, correcting or investigating a mixed-language magic-link email, and giving visible confirmation when “Setup for Agents” copies its prompt.

The strongest parts of the flow are:

- Payment and GitHub connection are skippable, so evaluation is possible without billing or repository access.
- The wizard preserves entered data when moving backward.
- The first project is created automatically.
- The dashboard tutorial points directly to API key creation.
- The free/no-payment path supported a real `gt init` → `gt generate` → `gt translate` workflow.
- Destructive project and organization actions require exact-name confirmation.

## Test matrix

| Path                               | Result                   | Notes                                                                                 |
| ---------------------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| Landing page → Get Started         | Pass                     | Reached the dashboard sign-in flow                                                    |
| Pricing → Starter → sign-in        | Pass                     | Preserved `selected_plan=tier1`; no visible plan-specific sign-in messaging           |
| Email magic-link signup            | Pass                     | Used synthetic disposable inboxes                                                     |
| GitHub OAuth entry                 | Partial                  | Redirect reached GitHub; no real credentials were entered                             |
| Google OAuth entry                 | Partial                  | Entry state tested; no real credentials were entered                                  |
| Enterprise SSO entry               | Partial                  | Company-email form tested; no enterprise identity was used                            |
| Four-step authenticated onboarding | Pass                     | Payment and GitHub steps skipped                                                      |
| Project/API key setup              | Pass                     | Temporary key created and used                                                        |
| Next.js CLI translation            | Pass                     | Three strings translated to Spanish and French                                        |
| Dashboard translation verification | Pass                     | Generated strings and both target locales appeared                                    |
| Mobile-sized public flow           | Pass                     | Landing, menu, pricing, sign-in, CAPTCHA, and OAuth entry tested                      |
| Keyboard-only sign-in              | Pass with limits         | Basic tabbing, visible focus, and CAPTCHA activation tested; no screen reader audit   |
| Framework docs                     | Pass                     | Reviewed Next.js, React, Python, and Locadex/coding-agent paths                       |
| Cleanup                            | Pass with one constraint | Keys, projects, organizations, and local apps deleted; synthetic user accounts remain |

## Findings

### 1. OAuth buttons do not explain that CAPTCHA is required

**Severity:** Medium  
**Area:** Sign-in  
**Reproducibility:** Reproduced repeatedly in fresh sessions

The GitHub and Google buttons look available before Cloudflare Turnstile is complete. Activating them in that state produces no visible response. The CAPTCHA appears below the OAuth choices, so the dependency is easy to miss.

**Suggested change:** Disable gated auth buttons until verification succeeds and add helper text such as “Complete the security check to continue,” or move the CAPTCHA before the gated controls.

### 2. Magic-link email used a different language for its primary CTA

**Severity:** Medium; needs targeted reproduction  
**Area:** Authentication email

In one English (`en-US`) signup, the email body was English but the primary “Sign in” CTA appeared in Arabic (`تسجيل الدخول`). The link still worked. This could be unintended locale leakage or an intentional product demonstration, but in an authentication email it reads as inconsistent and may reduce trust.

**Suggested change:** Verify how the transactional-email locale is selected. Keep the full email in one locale unless the user explicitly chose another.

### 3. “Setup for Agents” copies a prompt without visible confirmation

**Severity:** Low to medium  
**Area:** Landing-page hero

The control works: it copied an approximately 11,000-character setup prompt to the clipboard. It did not navigate, which is intentional. However, no toast, label change, or checkmark appeared after activation, so the user cannot tell whether anything happened without pasting.

**Suggested change:** Temporarily change the label to “Copied” or show a brief confirmation toast. Consider making the copy behavior explicit in the original label or nearby copy.

### 4. Invalid email input has no inline explanation

**Severity:** Low  
**Area:** Sign-in

Entering an invalid address leaves Continue disabled without an error message. The disabled state is visible, but the correction required is not stated.

**Suggested change:** Show an inline message after blur or submit attempt, for example “Enter a valid email address.”

### 5. “Starter” plan naming is ambiguous inside the project

**Severity:** Low to medium  
**Area:** Pricing and dashboard

The public pricing page presents Starter as the $0 tier. A newly created no-payment project showed integrations as “available on the Starter plan” alongside an Upgrade action. That makes it unclear whether the user is already on Starter, must add a payment method, or needs another paid tier.

**Suggested change:** Use the same plan names and entitlement language on pricing, onboarding, and project empty states. State the exact requirement when a feature is unavailable.

### 6. Framework selection does not explain what it changes

**Severity:** Low  
**Area:** Onboarding step 1

The framework question supports multiple selections, but the wizard creates one generic project and does not explain whether the choices personalize documentation, configure the project, or only feed analytics.

**Suggested change:** Add one line such as “We’ll use this to personalize setup guidance.”

### 7. No self-service account deletion was found

**Severity:** Medium  
**Area:** Account settings and cleanup

Project and organization deletion are available and well protected, but no user-account deletion control was found in the profile menu or settings reached during the audit. The synthetic accounts therefore remain after all workspaces and projects were removed.

**Suggested change:** Add a discoverable account-deletion path or link to the documented support process and data-retention policy.

### 8. Company website accepts arbitrary text

**Severity:** Low  
**Area:** Onboarding step 1

The website field accepted a clearly synthetic/nonstandard value without feedback. This does not block onboarding, but it can reduce analytics and enrichment data quality.

**Suggested change:** Either label the field as optional/free-form or apply lightweight URL/domain validation without rejecting legitimate local or pre-launch projects.

### 9. Step 1 has no in-form way to revisit an earlier disclosed answer

**Severity:** Low  
**Area:** Onboarding step 1

Questions are progressively disclosed, which keeps the form approachable. There is no explicit previous control within that step. Browser navigation from later steps preserved the answers, but the edit path is not obvious while still on step 1.

**Suggested change:** Keep completed questions editable and provide an obvious previous/edit affordance.

### 10. OAuth back navigation can lose sign-in context

**Severity:** Low  
**Area:** GitHub OAuth entry

After reaching GitHub’s login page, browser Back returned to the marketing landing page in one test rather than the sign-in form.

**Suggested change:** Verify the history stack for marketing-page entry and preserve the sign-in page as the immediate return location.

### 11. Minor transient rendering around CAPTCHA

**Severity:** Cosmetic  
**Area:** Sign-in

Returning to sign-in occasionally showed a brief “Verifying…” CAPTCHA state or a loading artifact where the “or” divider appears. It resolved without intervention.

**Suggested change:** Stabilize the initial auth-widget placeholder and divider layout to avoid a small visual jump.

## End-to-end developer setup

The live integration used a temporary Next.js app outside the repository:

1. Created a fresh synthetic account through email magic link.
2. Selected Next.js during onboarding.
3. Created the organization and automatically generated first project.
4. Skipped payment and GitHub connection.
5. Created a temporary project API key.
6. Installed `gt-next` and the `gt` CLI.
7. Ran:

   ```sh
   npx gt init --no-interactive \
     --project-id '<redacted>' \
     --default-locale en \
     --locales es fr \
     --storage local \
     --translations-dir public/_gt \
     --file-formats none \
     --no-locadex \
     --no-react-setup \
     --no-dev-credentials
   npx gt generate
   npx gt translate
   ```

8. The CLI completed two locale jobs and downloaded `es.json` and `fr.json`.
9. The dashboard showed the three source strings and their Spanish/French translations.

The translation command took approximately 23 seconds in this single small run. That is an observation, not a performance benchmark.

The audit verified extraction, translation generation, local files, and dashboard state. It did not separately verify translated browser rendering in the disposable app before cleanup.

## Mobile-sized and keyboard observations

At an approximately 390 × 844 browser viewport:

- No obvious horizontal overflow appeared on the tested landing, menu, pricing, or sign-in screens.
- The navigation drawer, sign-in controls, CAPTCHA, and OAuth entry points remained usable.
- No fixed element visibly covered the active form.

This was a resized Chromium viewport, not testing on physical iOS or Android hardware. Touch ergonomics, mobile browser chrome, virtual-keyboard behavior, and orientation changes remain unverified.

With keyboard-only interaction on desktop Chromium:

- The sign-in controls and Turnstile challenge were reachable.
- Space activated the focused CAPTCHA.
- No keyboard trap was encountered in the tested sign-in path.

This was not a complete accessibility conformance audit. Screen-reader output, semantic structure, contrast measurements, zoom/reflow, reduced motion, and all authenticated screens were not evaluated.

## Particularly good behavior

- The magic link arrived quickly in both successful signup attempts.
- The four-step wizard clearly showed progress.
- Payment can be skipped after a transparent $10-credit reminder.
- GitHub connection can be skipped without an unnecessary second confirmation.
- Moving from step 2 back to step 1 preserved the entered website, company size, referral source, and selected frameworks.
- The dashboard’s welcome tour points to API Keys, matching the next developer task.
- Empty locale copy explains that locales appear after the first translation request.
- Project and organization deletion both require typing the exact name.
- A no-payment account could create an API key and complete a real two-locale translation run.

## Constraints and untested areas

- No payment details were entered, so billing setup, card errors, credit redemption, invoices, and paid limits were not tested.
- No real GitHub organization or repository was connected, so installation permissions, repository selection, pull requests, and Locadex automation were not tested.
- GitHub/Google OAuth and enterprise SSO were tested only to their external entry points.
- Team invitations, roles, access controls, SCIM, audit logs, and multi-user review were not tested.
- Rate limits, network interruption, expired GT magic links, translation failures, and retry behavior were not induced.
- Safari, Firefox, Edge, physical mobile devices, and screen readers were not tested.
- Translation quality was spot-checked on only three simple strings in Spanish and French.
- The coding-agent prompt was copied and inspected, but a separate agent-driven repository integration was not completed.

## Cleanup

- Temporary API keys were deleted.
- Temporary projects and organizations were deleted.
- Temporary Next.js directories, generated translations, config, and environment files were removed.
- Final dashboard checks showed no remaining workspaces.
- Synthetic user accounts could not be deleted through the UI and remain dormant with no projects, organizations, billing details, or connected repositories.

## Suggested launch priorities

1. Clarify CAPTCHA gating for email and OAuth sign-in.
2. Reproduce and correct the mixed-language magic-link CTA if unintended.
3. Add visible confirmation to “Setup for Agents.”
4. Clarify Starter/free-tier entitlement copy.
5. Provide a self-service account-deletion or documented support path.
