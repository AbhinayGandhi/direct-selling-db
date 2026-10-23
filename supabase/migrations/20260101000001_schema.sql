-- ============================================================
-- 0001: Core schema (Direct Selling platform, Maharashtra / INR)
-- Money = numeric(12,2). Financial rows are never deleted.
-- ============================================================

create sequence public.order_number_seq start 1001;
create sequence public.complaint_number_seq start 1001;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','distributor','staff','admin')),
  account_status text not null default 'active' check (account_status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single-row table (id is always true)
create table public.company_settings (
  id boolean primary key default true check (id),
  legal_business_name text,
  registered_address text,
  support_email text,
  support_phone text,
  gstin text,
  grievance_officer_details text,
  delivery_charge numeric(12,2) not null default 0 check (delivery_charge >= 0),
  free_delivery_above numeric(12,2) check (free_delivery_above >= 0),
  return_window_days integer not null default 7 check (return_window_days >= 0),
  live_sales_enabled boolean not null default false,
  live_commission_enabled boolean not null default false,
  -- Reserved. No function in this project reads it. Multi-level/binary/matrix
  -- plans are NOT implemented and need documented legal review first.
  network_compensation_enabled boolean not null default false,
  compliance_review_status text not null default 'not_started'
    check (compliance_review_status in ('not_started','in_review','approved','rejected')),
  updated_at timestamptz not null default now(),
  constraint commission_requires_review
    check (not live_commission_enabled or compliance_review_status = 'approved')
);
insert into public.company_settings (id) values (true);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  contact_details jsonb not null default '{}',
  billing_details jsonb not null default '{}',
  license_information text,
  active_status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  category_name text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id),
  category_id uuid references public.categories(id),
  sku text not null unique,
  product_name text not null,
  description text,
  mrp numeric(12,2) not null check (mrp >= 0),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  purchase_cost numeric(12,2) not null default 0 check (purchase_cost >= 0),
  -- e.g. {"gst_rate": 5, "inclusive": true}
  applicable_tax_configuration jsonb not null default '{"gst_rate":0,"inclusive":true}',
  image_path text,
  stock_tracking_enabled boolean not null default true,
  stock_quantity integer not null default 0 check (stock_quantity >= 0), -- changed only by functions
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  active boolean not null default false, -- must be approved/activated by admin
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_not_above_mrp check (selling_price <= mrp)
);
create index products_category_idx on public.products(category_id);
create index products_supplier_idx on public.products(supplier_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  movement_type text not null check (movement_type in
    ('purchase_receipt','sale','cancel_restock','return_restock','damaged','adjustment')),
  quantity integer not null check (quantity <> 0), -- signed
  reference_type text,
  reference_id uuid,
  supplier_invoice_ref text,
  batch_number text,
  expiry_date date,
  unit_cost numeric(12,2),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index inv_mov_product_idx on public.inventory_movements(product_id, created_at desc);
create index inv_mov_ref_idx on public.inventory_movements(reference_type, reference_id);

create table public.distributors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id),
  distributor_code text unique,
  -- Attribution record only. Never used to compute any payment entitlement.
  sponsor_distributor_id uuid references public.distributors(id),
  application_status text not null default 'pending'
    check (application_status in ('pending','approved','rejected','suspended')),
  agreement_version text,
  agreement_accepted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint no_self_sponsor check (sponsor_distributor_id is distinct from id),
  constraint approved_has_code check (application_status <> 'approved' or distributor_code is not null)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id), -- nullable for future guest checkout
  contact_name text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.customers(id),
  attributed_distributor_id uuid references public.distributors(id),
  order_status text not null default 'pending' check (order_status in
    ('pending','confirmed','processing','shipped','delivered','cancelled',
     'return_requested','returned','refund_pending','refunded','payment_failed')),
  payment_status text not null default 'pending' check (payment_status in
    ('pending','pending_verification','paid','failed','refunded','partially_refunded')),
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  delivery_charge numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  shipping_details jsonb not null default '{}',
  courier_name text,
  tracking_number text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders(customer_id, created_at desc);
create index orders_distributor_idx on public.orders(attributed_distributor_id, created_at desc);
create index orders_status_idx on public.orders(order_status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  product_name_snapshot text not null,
  sku_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  unit_cost_snapshot numeric(12,2) not null,
  tax_snapshot jsonb not null,  -- {"rate":..,"inclusive":..,"amount":..}
  line_total numeric(12,2) not null,
  unique (order_id, product_id)
);
create index order_items_product_idx on public.order_items(product_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  payment_method text not null check (payment_method in
    ('manual_upi','bank_transfer','cash_on_delivery','online_provider')),
  provider_reference text,
  amount numeric(12,2) not null check (amount >= 0),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','verified','failed','refunded')),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index payments_order_idx on public.payments(order_id);
create unique index payments_ref_unique on public.payments(payment_method, provider_reference)
  where provider_reference is not null;

create table public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  order_item_id uuid not null references public.order_items(id),
  return_reason text not null,
  quantity integer not null check (quantity > 0),
  refund_amount numeric(12,2) check (refund_amount >= 0),
  return_status text not null default 'requested'
    check (return_status in ('requested','approved','rejected','refunded')),
  restock boolean not null default false,
  refund_reference text,
  requested_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index returns_order_idx on public.returns(order_id);
create index returns_item_idx on public.returns(order_item_id);

create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  commission_type text not null default 'direct_sales_percent'
    check (commission_type = 'direct_sales_percent'), -- no other plan types exist
  commission_rate numeric(6,5) not null check (commission_rate >= 0 and commission_rate <= 0.5),
  effective_from date not null,
  effective_until date,
  active boolean not null default false,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rule_dates check (effective_until is null or effective_until >= effective_from),
  constraint active_needs_approval check (not active or approved_by is not null)
);

create table public.sales_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  order_item_id uuid not null references public.order_items(id),
  distributor_id uuid not null references public.distributors(id),
  commission_rule_id uuid references public.commission_rules(id),
  qualifying_sales_amount numeric(12,2) not null,
  commission_rate_snapshot numeric(6,5) not null,
  commission_amount numeric(12,2) not null,
  calculation_basis text not null default 'line_total minus included GST; delivery and refunds excluded',
  commission_status text not null default 'pending'
    check (commission_status in ('pending','approved','paid','reversed','disputed')),
  reversal_of_commission_id uuid references public.sales_commissions(id),
  return_id uuid references public.returns(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  constraint sign_matches_type check (
    (reversal_of_commission_id is null and commission_amount >= 0) or
    (reversal_of_commission_id is not null and commission_amount <= 0))
);
-- Duplicate-commission protection: one original commission per order item,
-- and one reversal per return.
create unique index sales_commissions_one_per_item
  on public.sales_commissions(order_item_id) where reversal_of_commission_id is null;
create unique index sales_commissions_one_reversal_per_return
  on public.sales_commissions(return_id) where reversal_of_commission_id is not null;
create index sales_commissions_dist_idx on public.sales_commissions(distributor_id, commission_status);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references public.distributors(id),
  amount numeric(12,2) not null check (amount > 0),
  payout_status text not null default 'pending_approval'
    check (payout_status in ('pending_approval','approved','paid','failed','reversed')),
  approval_reference text,
  payment_reference text,
  failure_reason text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payouts_dist_idx on public.payouts(distributor_id, payout_status);
create unique index payouts_payment_ref_unique on public.payouts(payment_reference)
  where payment_reference is not null;

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  order_id uuid references public.orders(id),
  complaint_number text not null unique,
  subject text not null,
  description text not null,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  resolution_notes text,
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index complaints_customer_idx on public.complaints(customer_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  safe_metadata jsonb not null default '{}', -- never put secrets or full personal data here
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create table public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  policy_name text not null,
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  unique (profile_id, policy_name, policy_version)
);

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null,
  actor_id uuid not null,
  idempotency_key text not null,
  result_reference uuid,
  created_at timestamptz not null default now(),
  unique (operation_type, actor_id, idempotency_key)
);
