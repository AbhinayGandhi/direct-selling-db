# Direct Selling Platform (Supabase + React + Cloudflare Pages)

STATUS: Phase A (database) and Phase B (storefront, login, cart, checkout, my orders) done.
Distributor portal, admin portal, reports are NOT built yet. See PROGRESS.md.

## Folders
- `supabase/` database migrations (run in filename order), seed (demo only), tests
- `web/` React + TypeScript + Vite app

## Database
Supabase Dashboard -> SQL Editor -> run the 4 files in `supabase/migrations` in order.
Make the first admin (after you have a user): 
`update public.profiles set role='admin' where id=(select id from auth.users where email='YOU@example.com');`

## Turn on selling (when you are ready, SQL Editor)
`update public.company_settings set legal_business_name='...', registered_address='...', support_email='...', support_phone='...', live_sales_enabled=true;`
Commission stays OFF. The database refuses to enable it until `compliance_review_status='approved'`.

## Run the web app locally
cd web && cp .env.example .env.local   (fill in URL + anon key) && npm install && npm run dev
Checks: `npm run build` and `npm test`.

## Deploy on Cloudflare Pages (Git integration)
Workers & Pages -> Create -> Pages -> Connect to Git -> choose the repository, then:
- Production branch: main
- Root directory: `web`
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_MODE=production, VITE_POLICIES_APPROVED=false
Then Supabase -> Authentication -> URL Configuration: add your *.pages.dev address as Site URL.
`web/public/_redirects` makes page links work after refresh.

## Safety defaults
Sales and commission flags are false by default. Only direct-sales % commission exists; no recruitment, joining-fee, binary, matrix or multi-level logic exists in code. Prices, tax and stock are decided by the database, never by the browser.
