-- ============================================================
-- 0002: helper functions and protective triggers
-- ============================================================

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger trg_profiles_upd before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_company_upd before update on public.company_settings for each row execute function public.set_updated_at();
create trigger trg_suppliers_upd before update on public.suppliers for each row execute function public.set_updated_at();
create trigger trg_products_upd before update on public.products for each row execute function public.set_updated_at();
create trigger trg_customers_upd before update on public.customers for each row execute function public.set_updated_at();
create trigger trg_orders_upd before update on public.orders for each row execute function public.set_updated_at();
create trigger trg_returns_upd before update on public.returns for each row execute function public.set_updated_at();
create trigger trg_payouts_upd before update on public.payouts for each row execute function public.set_updated_at();

-- Role helpers (SECURITY DEFINER so RLS policies can call them without recursion)
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and account_status = 'active'
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'admin', false)
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() in ('staff','admin'), false)
$$;
create or replace function public.current_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.customers c join public.profiles p on p.id = c.profile_id
  where c.profile_id = auth.uid() and p.account_status = 'active'
$$;
create or replace function public.current_distributor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select d.id from public.distributors d join public.profiles p on p.id = d.profile_id
  where d.profile_id = auth.uid() and d.application_status = 'approved' and p.account_status = 'active'
$$;

-- Internal audit writer (not callable by API users; see grants)
create or replace function public.write_audit(p_action text, p_entity_type text, p_entity_id uuid, p_meta jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, safe_metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_meta,'{}'))
$$;

-- New auth user -> profile (always role 'customer') + customer record.
-- Role is NEVER taken from client-supplied metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  insert into public.customers(profile_id, contact_name, phone, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone', new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Defence in depth: only an admin (or the DB owner/service role) may change role or status
create or replace function public.guard_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.account_status is distinct from old.account_status)
     and auth.uid() is not null and not public.is_admin() then
    raise exception 'not allowed to change role or account status' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- Financial history can never be deleted; ledgers can never be edited in place
create or replace function public.block_delete() returns trigger
language plpgsql as $$ begin raise exception 'deleting from % is not allowed; use a reversal/adjustment entry', tg_table_name using errcode = '42501'; end $$;
create or replace function public.block_update() returns trigger
language plpgsql as $$ begin raise exception 'rows in % are immutable', tg_table_name using errcode = '42501'; end $$;

do $$
declare t text;
begin
  foreach t in array array['orders','order_items','payments','returns','commission_rules',
      'sales_commissions','payouts','inventory_movements','audit_logs','profiles','distributors',
      'customers','complaints','policy_acceptances','idempotency_keys'] loop
    execute format('create trigger trg_%s_nodelete before delete on public.%I for each row execute function public.block_delete()', t, t);
  end loop;
  foreach t in array array['audit_logs','inventory_movements','order_items','policy_acceptances','idempotency_keys'] loop
    execute format('create trigger trg_%s_noupdate before update on public.%I for each row execute function public.block_update()', t, t);
  end loop;
end $$;

-- Audit changes to company settings (live flags, compliance status)
create or replace function public.audit_company_settings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit('company_settings_updated','company_settings',null,
    jsonb_build_object('live_sales_enabled',new.live_sales_enabled,
      'live_commission_enabled',new.live_commission_enabled,
      'compliance_review_status',new.compliance_review_status));
  return new;
end $$;
create trigger trg_company_audit after update on public.company_settings
  for each row execute function public.audit_company_settings();
