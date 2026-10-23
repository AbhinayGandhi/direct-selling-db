# Direct Selling Platform (Supabase + React + Cloudflare Pages)

STATUS: Phase A (database) done. Frontend, portals, deployment NOT built yet. See PROGRESS.md.

## Database (supabase/migrations, run in filename order)
1. 000001 schema (19 tables) 2. 000002 helpers/triggers 3. 000003 business functions 4. 000004 RLS + grants

Apply: Supabase Dashboard -> SQL Editor -> paste each file in order -> Run. (Or `supabase db push` with the CLI.)
Seed demo data only on a test project: `supabase/seed.sql`.

## Safety defaults
- `live_sales_enabled = false`, `live_commission_enabled = false`, `compliance_review_status = 'not_started'`.
- DB constraint: commissions cannot be enabled unless compliance status is `approved` (set only after professional review).
- Only direct-sales % commission exists. No recruitment, joining-fee, binary, matrix or multi-level logic exists in code.
- Financial/audit rows cannot be deleted; corrections are reversal rows.

## Make the first admin (one time, SQL Editor)
Sign up in the app first, then run (replace the email):
`update public.profiles set role='admin' where id=(select id from auth.users where email='YOU@example.com');`

## Tests (local throwaway Postgres only)
`supabase/tests/run_local.sh` uses a stub of Supabase's auth schema. It is NOT a substitute for testing on a real Supabase project.
