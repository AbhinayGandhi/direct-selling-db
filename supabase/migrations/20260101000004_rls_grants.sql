-- ============================================================
-- 0004: privileges and Row Level Security (default deny)
-- ============================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- RLS helper functions
grant execute on function public.current_role_name(), public.is_admin(), public.is_staff(),
  public.current_customer_id(), public.current_distributor_id() to anon, authenticated;

-- Callable business functions (each checks the caller internally)
grant execute on function
  public.create_order(jsonb,jsonb,text,text,text), public.cancel_my_order(uuid,text),
  public.confirm_payment(uuid,text), public.update_order_status(uuid,text,text,text),
  public.create_commission_rule(text,numeric,date,date), public.approve_commission_rule(uuid),
  public.approve_commissions(uuid[]), public.dispute_commission(uuid,text),
  public.request_return(uuid,int,text), public.decide_return(uuid,boolean,boolean,numeric),
  public.record_refund(uuid,text), public.distributor_payable_balance(uuid),
  public.request_payout(uuid,numeric), public.approve_payout(uuid,text),
  public.mark_payout_paid(uuid,text), public.fail_or_reverse_payout(uuid,text),
  public.apply_distributor(text,text), public.review_distributor(uuid,text),
  public.receive_stock(uuid,int,text,text,date,numeric), public.adjust_stock(uuid,int,text,text),
  public.create_complaint(uuid,text,text), public.update_complaint(uuid,text,text,uuid),
  public.admin_set_role(uuid,text,text)
to authenticated;

-- Enable RLS everywhere
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop; end $$;

-- profiles: own row (name/phone only) or staff read
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- company_settings: admin only (public gets a safe view below)
grant select, update on public.company_settings to authenticated;
create policy company_select on public.company_settings for select to authenticated using (public.is_admin());
create policy company_update on public.company_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- suppliers
grant select, insert, update on public.suppliers to authenticated;
create policy suppliers_select on public.suppliers for select to authenticated using (public.is_staff());
create policy suppliers_insert on public.suppliers for insert to authenticated with check (public.is_admin());
create policy suppliers_update on public.suppliers for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- categories
grant select on public.categories to anon, authenticated;
grant insert, update on public.categories to authenticated;
create policy categories_select on public.categories for select to anon, authenticated using (active or public.is_staff());
create policy categories_insert on public.categories for insert to authenticated with check (public.is_admin());
create policy categories_update on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- products: stock_quantity is NOT writable from the API (functions only)
grant select on public.products to authenticated;
grant insert (supplier_id, category_id, sku, product_name, description, mrp, selling_price, purchase_cost,
  applicable_tax_configuration, image_path, stock_tracking_enabled, low_stock_threshold, active) on public.products to authenticated;
grant update (supplier_id, category_id, sku, product_name, description, mrp, selling_price, purchase_cost,
  applicable_tax_configuration, image_path, stock_tracking_enabled, low_stock_threshold, active) on public.products to authenticated;
create policy products_select on public.products for select to authenticated using (public.is_staff());
create policy products_insert on public.products for insert to authenticated with check (public.is_admin());
create policy products_update on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- read-only tables
grant select on public.inventory_movements, public.distributors, public.orders, public.order_items, public.payments,
  public.returns, public.commission_rules, public.sales_commissions, public.payouts, public.complaints,
  public.audit_logs, public.policy_acceptances to authenticated;

create policy inv_select on public.inventory_movements for select to authenticated using (public.is_staff());
create policy dist_select on public.distributors for select to authenticated using (profile_id = auth.uid() or public.is_staff());
create policy orders_select on public.orders for select to authenticated using (customer_id = public.current_customer_id() or public.is_staff());
create policy items_select on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));
create policy pay_select on public.payments for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));
create policy ret_select on public.returns for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));
create policy rules_select on public.commission_rules for select to authenticated using (public.is_admin() or (active and approved_by is not null));
create policy comm_select on public.sales_commissions for select to authenticated using (distributor_id = public.current_distributor_id() or public.is_admin());
create policy payouts_select on public.payouts for select to authenticated using (distributor_id = public.current_distributor_id() or public.is_admin());
create policy complaints_select on public.complaints for select to authenticated using (customer_id = public.current_customer_id() or public.is_staff());
create policy audit_select on public.audit_logs for select to authenticated using (public.is_admin());
create policy pol_select on public.policy_acceptances for select to authenticated using (profile_id = auth.uid() or public.is_admin());

-- customers: own contact details
grant select on public.customers to authenticated;
grant update (contact_name, phone, email) on public.customers to authenticated;
create policy cust_select on public.customers for select to authenticated using (profile_id = auth.uid() or public.is_staff());
create policy cust_update on public.customers for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- policy acceptance (own only)
grant insert (profile_id, policy_name, policy_version) on public.policy_acceptances to authenticated;
create policy pol_insert on public.policy_acceptances for insert to authenticated with check (profile_id = auth.uid());

-- idempotency_keys: RLS on, no policies => no API access

-- ---------- Safe public / limited views ----------
-- (views run with owner rights, so each one filters explicitly)
create view public.public_products as
  select id, sku, product_name, description, category_id, mrp, selling_price,
         applicable_tax_configuration, image_path,
         (not stock_tracking_enabled or stock_quantity > 0) as in_stock
  from public.products where active;
create view public.public_company_info as
  select legal_business_name, registered_address, support_email, support_phone, gstin,
         grievance_officer_details, delivery_charge, free_delivery_above, return_window_days
  from public.company_settings;
-- Distributors see sales WITHOUT any customer personal data
create view public.distributor_sales as
  select o.id as order_id, o.order_number, o.order_status, o.created_at, o.delivered_at, o.subtotal
  from public.orders o where o.attributed_distributor_id = public.current_distributor_id();
grant select on public.public_products, public.public_company_info to anon, authenticated;
grant select on public.distributor_sales to authenticated;
