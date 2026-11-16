# LaquTum

Pattern-based aptitude learning built with vanilla HTML/CSS/JavaScript and Supabase. The existing learning engine, navigation, styles, diagnostics, practice, and teaching framework remain in place.

## Local use

Use Node 24+ and Python 3:

```powershell
npm test
npm run serve
```

Open http://127.0.0.1:8080. The engine harness is at `/engine/test-harness.html`. Login requires the configured Supabase project. AI and payments require the server setup below; they do not fall back to insecure browser credentials or unverified unlocks.

## Server setup required before publishing this update

The source changes do not deploy themselves. Revoke the previously exposed AI credential in its provider dashboard and replace it. Never paste the replacement into JavaScript, chat, or a publicly served folder.

1. Install/login to the official Supabase CLI and link the intended project.
2. Apply `supabase/migrations/202610170001_secure_services.sql` to the existing database. It assumes `user_progress` exists with `user_id` and `unlocked_topics`. It adds notebook/route fields, owner restrictions, protected entitlement fields, payment tables and a mentor quota. Existing CRM-issued access is preserved. Test against a staging copy first if your live schema has additional custom policies or triggers.
3. Set Supabase function secrets: `GEMINI_API_KEY`, optional `GEMINI_MODEL`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET`. Use Razorpay test credentials for initial verification. Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. No server secret belongs in the frontend.
4. Deploy `ai-mentor` and `payments`. Both validate bearer tokens using Supabase Auth; gateway JWT checks are disabled in config to support the existing publishable client key.
5. Enable automatic payment capture in Razorpay. Test successful payment, cancellation, failure, and retry verification before switching to live credentials.
6. Upload the repaired `content-bank.json` to the existing public `content` storage bucket with the frontend update. Invalid or unavailable remote content falls back to the bundled bank.

Example CLI commands, after creating a secrets file outside the served/project directory:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set --env-file C:/private/laqutum-functions.env
supabase functions deploy ai-mentor
supabase functions deploy payments
```

The frontend still uses the public project URL/key in `supabase-config.js`. Serve only frontend assets, `engine/`, and the content bank; do not expose local secrets, test tooling, or database administration files through your production host.

## Behavior and recovery

- AI keeps the existing four-section LaquTum teaching prompt on the server, supports text/images and six history messages, and enforces 100 requests per user per UTC day. Service failures display a retry message instead of a simulated answer.
- Checkout creates a server-priced ₹1,499 order bound to the authenticated account. Access requires signature, ownership, amount, currency, and captured-payment checks. Grants last six calendar months; repeated verification of an order does not extend them.
- Pending payment responses are cached per account for retry after refresh. If the browser closes before receiving the callback, automatic reconciliation is not implemented: inspect Razorpay and server-side order records before asking a learner to pay again. Refund reconciliation remains an administrative operation.
- Notebook and route caches are per account and hydrate from cloud progress. Failed writes remain local and retry on the next account hydration. Legacy unscoped caches are retained but not automatically assigned to a user, because their owner cannot be determined safely.
- Demo profiles, notes, and automated replies are labeled. No social layout was redesigned.
- The migration secures progress/payment tables. Existing social table policies and realtime permissions still need a live backend audit; their definitions were not supplied in this folder.
- The content bank remains public, as in the original architecture. Payment verification protects account entitlements; it is not DRM for downloadable lessons.

## Checks

`npm test` checks script parsing, HTML script references, all content navigation references, answer-index validity, engine startup, account isolation/cloud recovery, remote-bank fallback, and mocked AI/payment handlers. Provider calls use fixtures, never real payments.

Optional database validation with `@electric-sql/pglite` installed outside this project:

```powershell
node scripts/validate-sql.cjs C:/path/to/node_modules/@electric-sql/pglite
```

This executes the migration in PostgreSQL and verifies ownership, protected fields, free-topic limits, payment idempotency, and mentor quotas with JSON and array topic columns. It does not replace testing against the actual deployment schema.

`scripts/repair-content.cjs` documents two corrected drill IDs, thirteen restored successive-price-change questions, and eight missing escalation destinations. Restored questions remain marked `author_reviewed: false` for editorial review.

Provider references: [Razorpay integration](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps/), [Gemini content API](https://ai.google.dev/api/generate-content), [Supabase authentication](https://supabase.com/docs/guides/auth/server-side).

## Interface and local visual review

The rebuilt course workspace uses `workspace.css` (shell and topic library), `workspace-learning.css` (lessons, practice, accounts and learning tools), and `workspace-tools.css` (tutor, groups and challenges). The old `styles.css`, `preview.css`, and `light.css` are retained as archival source only and are not loaded. `DESIGN.md` records the new system; `PRODUCT.md` records the preserved product scope.

The interface uses desktop side navigation and mobile bottom navigation, searchable topic rows with progress states, and a saved-lesson continue action. Existing service and content contracts remain in place.

For an isolated UI preview without a real account, run `python scripts/design-server.py` and open `http://127.0.0.1:8080/__preview`. This localhost-only development server substitutes a fixture account and stubbed Supabase calls in the served HTML. Do not deploy this server. The normal `/` route keeps the real sign-in flow.

`scripts/render-ui.cjs` captures 11 screens at four viewport sizes (320px, 390px, 820px and 1440px) in an isolated headless process. `node scripts/smoke-ui.cjs` checks topic search and filters, lesson and answer flow, learning tools, navigation and account form switching. It requires an external playwright-core installation (`PLAYWRIGHT_CORE_PATH`) and a headless executable (`HEADLESS_CHROME_PATH`, see script defaults); it never connects to a user's browser. Outputs live in `artifacts/ui-rebuild/`. Original UI files are backed up in `artifacts/pre-rebuild-backup-20261115/`.
