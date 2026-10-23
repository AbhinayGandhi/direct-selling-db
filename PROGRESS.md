# Progress
- [x] A. Database: schema, functions, RLS. 103/103 tests passed on local PostgreSQL 16 (auth stub). On the real Supabase project the owner confirmed: 4 files ran with Success; 19 tables; RLS on 19; sales/commission flags false.
- [ ] A2. Functions (orders, payments, commissions) not yet exercised on the real Supabase project.
- [x] B. Web app source: storefront, bilingual Marathi/English, catalogue + search + categories + pagination, product page, cart, checkout (server-side create_order with idempotency key), login/signup/reset, my orders + cancel, policy pages (draft), contact. `npm run build` OK; 4 unit tests pass.
- [ ] B2. Not verified: running against real Supabase, real phone layout, PWA offline (only a manifest exists, no service worker, no icons).
- [ ] C. Customer returns/complaints screens, distributor portal, admin portal
- [ ] D. Reports + expenses table, Marathi user guide, security & compliance checklists
- [ ] E. GitHub push + Cloudflare Pages connection (owner dashboard steps in README)
Known limits: no payment gateway (manual verification), login required to order, product images need a public https image URL until Supabase Storage is set up.
