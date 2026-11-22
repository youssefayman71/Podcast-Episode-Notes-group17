# Podcast Episode Notes — Phase 2 implementation candidate

Group 17 | Youssef: Discovery; Steven: Notes; Anas: Library/Identity. This is starter implementation to test, develop and adapt—not proof of final deployment or individual contribution.

## Local quick start

**Prerequisites:** Node.js 22+, npm, Git, browser. Inside `backend/`: `npm install`; copy `.env.example` to `.env`; change `AUTH_SECRET` to a randomly generated string (32+ characters); `npm start`. Serve `frontend/` on port 8080 using `npx http-server frontend -p 8080` from the repository root (or `python -m http.server 8080 --directory frontend`). Open `http://localhost:8080`. You may also run with two VS Code terminals.

**Flow:** Register → sign in → search iTunes → import + save → create timestamped note → add a tag → mark note reviewed → finish listening. Other users cannot access your notes. Admin moderation is backend-enforced. To create a test admin locally, register a separate account, then run `node src/promote-admin.js admin@example.com` in `backend/` while using the same database; sign in again. Do not expose admin provisioning to the public API.

**Persistence:** local SQLite via Node 22 `node:sqlite` (may show an experimental warning). Cloud target uses DynamoDB with `STORE=dynamo`. Do not commit `.db` files or `.env`.

**Cloud:** `docs/DEPLOY_FLOCI.md` is the deployment sequence. Floci is local/emulated AWS, so `localhost:4566` is not publicly accessible; a public HTTPS frontend/API requires another approved hosting path or actual AWS. Verify with your tutor what counts as a deployed demonstration. The deployment is **not already completed** by this ZIP.

**Evidence:** `docs/REPORT_DRAFT.docx` (generated separately) and `docs/security-test-results.csv`. Fill in *real* URLs/screenshots/tests/commits after building and deploying.

## Suggested ownership and branch names

- `feature/youssef-discovery`: discovery UI, import eligibility, upstream API handling, tests and dedicated Lambda.
- `feature/steven-notes`: timestamped note UI, note workflow, note storage and tests and dedicated Lambda.
- `feature/anas-library`: authentication, saved episodes, progress, tags, stats, and dedicated Lambda.

## Limitations you must resolve

- No public deployment, production HTTPS, real database backup, CloudWatch monitoring, or end-to-end security verification has been performed here.
- This teaching-scale backend uses straightforward DynamoDB full scans and a homemade HMAC session implementation to keep the code approachable. For production: replace it with a managed identity provider (your original proposal named Supabase Auth), server-side revocation/refresh, DynamoDB queries with GSIs, robust rate limits, audit trails, and atomic database constraints/transactions.
- Current local registration permits listener only. Admin provisioning is a trusted local operator action, not public signup.
- iTunes discovery search needs internet connectivity and a working upstream response.
- Some Node package versions and Floci Lambda compatibility may require adjustment after a real local installation.
