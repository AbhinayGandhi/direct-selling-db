-- ============================================================
-- 0003: transaction-safe business functions (all SECURITY DEFINER,
-- all authorise the caller inside the function)
-- ============================================================

create or replace function public.require_staff() returns void
language plpgsql stable security definer set search_path = public as $$
begin if not public.is_staff() then raise exception 'staff access required' using errcode='42501'; end if; end $$;
create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin if not public.is_admin() then raise exception 'admin access required' using errcode='42501'; end if; end $$;

-- Valid order state machine
create or replace function public.assert_transition(p_from text, p_to text) returns void
language plpgsql immutable as $$
begin
  if not ( (p_from,p_to) in (
    ('pending','confirmed'),('pending','cancelled'),('pending','payment_failed'),
    ('payment_failed','pending'),('payment_failed','cancelled'),
    ('confirmed','processing'),('confirmed','cancelled'),
    ('processing','shipped'),('processing','cancelled'),
    ('shipped','delivered'),
    ('delivered','return_requested'),
    ('return_requested','returned'),('return_requested','delivered'),
    ('returned','refund_pending'),('refund_pending','refunded')) ) then
    raise exception 'invalid order status change: % -> %', p_from, p_to;
  end if;
end $$;

-- ---------- Orders ----------
create or replace function public.create_order(
  p_items jsonb, p_shipping jsonb, p_payment_method text,
  p_idempotency_key text, p_distributor_code text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_set public.company_settings%rowtype;
  v_customer uuid; v_existing uuid; v_order uuid; v_dist uuid;
  v_item jsonb; v_p public.products%rowtype; v_qty int;
  v_line numeric(12,2); v_rate numeric; v_incl boolean; v_tax numeric(12,2);
  v_subtotal numeric(12,2) := 0; v_tax_total numeric(12,2) := 0; v_tax_extra numeric(12,2) := 0;
  v_delivery numeric(12,2) := 0;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not exists (select 1 from public.profiles where id=v_uid and account_status='active') then
    raise exception 'account is not active' using errcode='42501'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'idempotency key required'; end if;

  select result_reference into v_existing from public.idempotency_keys
   where operation_type='create_order' and actor_id=v_uid and idempotency_key=p_idempotency_key;
  if found then return v_existing; end if;   -- repeated submission: same order, no second deduction

  select * into v_set from public.company_settings;
  if not v_set.live_sales_enabled then raise exception 'sales are not enabled yet'; end if;
  if p_payment_method not in ('manual_upi','bank_transfer','cash_on_delivery','online_provider') then
    raise exception 'invalid payment method'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'items must be a list of 1 to 50 entries'; end if;
  if (select count(distinct x->>'product_id') from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) then
    raise exception 'duplicate product in items'; end if;
  if jsonb_typeof(p_shipping) is distinct from 'object'
     or coalesce(p_shipping->>'name','') = '' or coalesce(p_shipping->>'phone','') = ''
     or coalesce(p_shipping->>'address_line','') = '' or coalesce(p_shipping->>'city','') = ''
     or coalesce(p_shipping->>'state','') = '' or (p_shipping->>'pincode') !~ '^[1-9][0-9]{5}$' then
    raise exception 'complete shipping details required (name, phone, address_line, city, state, 6-digit pincode)';
  end if;

  select id into v_customer from public.customers where profile_id = v_uid;
  if v_customer is null then
    insert into public.customers(profile_id, contact_name, phone) values (v_uid, p_shipping->>'name', p_shipping->>'phone')
    returning id into v_customer;
  end if;

  -- Attribution is derived on the server from the code only; self-referral earns nothing.
  if p_distributor_code is not null and p_distributor_code <> '' then
    select id into v_dist from public.distributors
     where distributor_code = upper(p_distributor_code) and application_status='approved' and profile_id <> v_uid;
  end if;

  insert into public.orders(order_number, customer_id, attributed_distributor_id, shipping_details, payment_status)
  values ('ORD-' || to_char(now(),'YYMMDD') || '-' || nextval('public.order_number_seq'),
          v_customer, v_dist, p_shipping,
          case when p_payment_method in ('manual_upi','bank_transfer') then 'pending_verification' else 'pending' end)
  returning id into v_order;

  -- lock products in a fixed order to avoid deadlocks
  for v_item in select x from jsonb_array_elements(p_items) x order by x->>'product_id' loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 100 then raise exception 'quantity must be 1 to 100'; end if;
    select * into v_p from public.products where id = (v_item->>'product_id')::uuid and active for update;
    if not found then raise exception 'product not available'; end if;
    if v_p.stock_tracking_enabled then
      if v_p.stock_quantity < v_qty then raise exception 'insufficient stock for %', v_p.sku; end if;
      update public.products set stock_quantity = stock_quantity - v_qty where id = v_p.id;
      insert into public.inventory_movements(product_id, movement_type, quantity, reference_type, reference_id, created_by)
      values (v_p.id, 'sale', -v_qty, 'order', v_order, v_uid);
    end if;
    v_line := round(v_p.selling_price * v_qty, 2);
    v_rate := coalesce((v_p.applicable_tax_configuration->>'gst_rate')::numeric, 0);
    v_incl := coalesce((v_p.applicable_tax_configuration->>'inclusive')::boolean, true);
    if v_incl then v_tax := round(v_line - v_line / (1 + v_rate/100), 2);
    else v_tax := round(v_line * v_rate/100, 2); v_tax_extra := v_tax_extra + v_tax; end if;
    insert into public.order_items(order_id, product_id, product_name_snapshot, sku_snapshot, quantity,
        unit_price, unit_cost_snapshot, tax_snapshot, line_total)
    values (v_order, v_p.id, v_p.product_name, v_p.sku, v_qty, v_p.selling_price, v_p.purchase_cost,
        jsonb_build_object('rate',v_rate,'inclusive',v_incl,'amount',v_tax), v_line);
    v_subtotal := v_subtotal + v_line; v_tax_total := v_tax_total + v_tax;
  end loop;

  if v_set.free_delivery_above is not null and v_subtotal >= v_set.free_delivery_above then v_delivery := 0;
  else v_delivery := v_set.delivery_charge; end if;

  update public.orders set subtotal=v_subtotal, tax_amount=v_tax_total, delivery_charge=v_delivery,
         total_amount = v_subtotal + v_tax_extra + v_delivery - discount_amount
   where id = v_order;
  insert into public.payments(order_id, payment_method, amount)
  select v_order, p_payment_method, total_amount from public.orders where id = v_order;
  insert into public.idempotency_keys(operation_type, actor_id, idempotency_key, result_reference)
  values ('create_order', v_uid, p_idempotency_key, v_order);
  perform public.write_audit('order_created','order',v_order,jsonb_build_object('method',p_payment_method));
  return v_order;
end $$;

-- internal: restock + cancel
create or replace function public._cancel_order(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype; r record;
begin
  select * into v_o from public.orders where id = p_order for update;
  perform public.assert_transition(v_o.order_status, 'cancelled');
  for r in select oi.product_id, oi.quantity from public.order_items oi
            join public.products p on p.id = oi.product_id and p.stock_tracking_enabled
           where oi.order_id = p_order order by oi.product_id loop
    update public.products set stock_quantity = stock_quantity + r.quantity where id = r.product_id;
    insert into public.inventory_movements(product_id, movement_type, quantity, reference_type, reference_id, created_by)
    values (r.product_id, 'cancel_restock', r.quantity, 'order', p_order, auth.uid());
  end loop;
  update public.orders set order_status='cancelled', cancel_reason=left(p_reason,500) where id = p_order;
  perform public.write_audit('order_cancelled','order',p_order,'{}');
end $$;

create or replace function public.cancel_my_order(p_order_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select order_status into v_status from public.orders
   where id = p_order_id and customer_id = public.current_customer_id() for update;
  if not found then raise exception 'order not found'; end if;
  if v_status not in ('pending','confirmed') then
    raise exception 'order can no longer be cancelled online; please raise a complaint/support request'; end if;
  perform public._cancel_order(p_order_id, p_reason);
end $$;

create or replace function public.confirm_payment(p_order_id uuid, p_provider_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype; v_pay public.payments%rowtype;
begin
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  select * into v_pay from public.payments where order_id = p_order_id and payment_status='pending'
   order by created_at desc limit 1 for update;
  if not found then raise exception 'no pending payment for this order'; end if;
  if v_pay.payment_method = 'online_provider' then
    -- only the trusted server (Edge Function using the service role) may confirm online payments
    if coalesce(auth.role(),'') <> 'service_role' then
      raise exception 'online payments can only be confirmed by the verified provider webhook' using errcode='42501'; end if;
    if coalesce(p_provider_reference,'') = '' then raise exception 'provider reference required'; end if;
  else
    perform public.require_staff();
  end if;
  update public.payments set payment_status='verified', verified_at=now(), verified_by=auth.uid(),
         provider_reference = coalesce(p_provider_reference, provider_reference) where id = v_pay.id;
  update public.orders set payment_status='paid' where id = p_order_id;
  if v_o.order_status = 'pending' then
    perform public.assert_transition('pending','confirmed');
    update public.orders set order_status='confirmed' where id = p_order_id;
  elsif v_o.order_status = 'delivered' then
    perform public._generate_commissions(p_order_id);
  end if;
  perform public.write_audit('payment_confirmed','order',p_order_id,'{}');
end $$;

create or replace function public.update_order_status(p_order_id uuid, p_new_status text,
  p_courier text default null, p_tracking text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype;
begin
  perform public.require_staff();
  if p_new_status in ('return_requested','returned','refund_pending','refunded') then
    raise exception 'use the return/refund functions for status %', p_new_status; end if;
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  perform public.assert_transition(v_o.order_status, p_new_status);
  if p_new_status = 'cancelled' then perform public._cancel_order(p_order_id, 'cancelled by staff'); return; end if;
  if p_new_status = 'confirmed' and v_o.payment_status <> 'paid'
     and not exists (select 1 from public.payments where order_id=p_order_id and payment_method='cash_on_delivery') then
    raise exception 'payment must be verified before confirming'; end if;
  update public.orders set order_status = p_new_status,
     courier_name = coalesce(p_courier, courier_name), tracking_number = coalesce(p_tracking, tracking_number),
     shipped_at = case when p_new_status='shipped' then now() else shipped_at end,
     delivered_at = case when p_new_status='delivered' then now() else delivered_at end
   where id = p_order_id;
  if p_new_status = 'delivered' then perform public._generate_commissions(p_order_id); end if;
  perform public.write_audit('order_status_changed','order',p_order_id,
    jsonb_build_object('from',v_o.order_status,'to',p_new_status));
end $$;

-- ---------- Commission engine (direct sales only) ----------
create or replace function public._generate_commissions(p_order uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype; v_rule public.commission_rules%rowtype; v_n integer := 0; r record; v_base numeric(12,2);
begin
  if not (select live_commission_enabled from public.company_settings) then return 0; end if;
  select * into v_o from public.orders where id = p_order;
  if v_o.attributed_distributor_id is null or v_o.order_status <> 'delivered' or v_o.payment_status <> 'paid' then return 0; end if;
  if not exists (select 1 from public.distributors where id = v_o.attributed_distributor_id and application_status='approved') then return 0; end if;
  select * into v_rule from public.commission_rules
   where active and approved_by is not null and effective_from <= current_date
     and (effective_until is null or effective_until >= current_date)
   order by effective_from desc limit 1;
  if not found then return 0; end if;
  for r in select * from public.order_items where order_id = p_order loop
    -- eligible base = item value excluding GST; delivery fee never included
    v_base := r.line_total - case when (r.tax_snapshot->>'inclusive')::boolean then (r.tax_snapshot->>'amount')::numeric else 0 end;
    insert into public.sales_commissions(order_id, order_item_id, distributor_id, commission_rule_id,
        qualifying_sales_amount, commission_rate_snapshot, commission_amount)
    values (p_order, r.id, v_o.attributed_distributor_id, v_rule.id, v_base, v_rule.commission_rate,
        round(v_base * v_rule.commission_rate, 2))
    on conflict (order_item_id) where reversal_of_commission_id is null do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;

create or replace function public.create_commission_rule(p_name text, p_rate numeric, p_from date, p_until date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_admin();
  insert into public.commission_rules(rule_name, commission_rate, effective_from, effective_until, created_by)
  values (p_name, p_rate, p_from, p_until, auth.uid()) returning id into v_id;
  perform public.write_audit('commission_rule_created','commission_rule',v_id,jsonb_build_object('rate',p_rate));
  return v_id;
end $$;

create or replace function public.approve_commission_rule(p_rule_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.commission_rules set approved_by=auth.uid(), approved_at=now(), active=true where id=p_rule_id;
  if not found then raise exception 'rule not found'; end if;
  perform public.write_audit('commission_rule_approved','commission_rule',p_rule_id,'{}');
end $$;

create or replace function public.approve_commissions(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  perform public.require_admin();
  update public.sales_commissions set commission_status='approved', approved_at=now(), approved_by=auth.uid()
   where id = any(p_ids) and commission_status='pending';
  get diagnostics v_n = row_count;
  perform public.write_audit('commissions_approved','sales_commission',null,jsonb_build_object('count',v_n));
  return v_n;
end $$;

create or replace function public.dispute_commission(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.sales_commissions set commission_status='disputed' where id=p_id and commission_status in ('pending','approved');
  if not found then raise exception 'commission cannot be disputed'; end if;
  perform public.write_audit('commission_disputed','sales_commission',p_id,jsonb_build_object('note',left(p_note,200)));
end $$;

-- ---------- Returns & refunds ----------
create or replace function public.request_return(p_order_item_id uuid, p_quantity int, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype; v_i public.order_items%rowtype; v_set public.company_settings%rowtype; v_used int; v_id uuid;
begin
  select * into v_i from public.order_items where id = p_order_item_id;
  if not found then raise exception 'item not found'; end if;
  select * into v_o from public.orders where id = v_i.order_id and customer_id = public.current_customer_id() for update;
  if not found then raise exception 'order not found'; end if;
  select * into v_set from public.company_settings;
  if v_o.order_status not in ('delivered','return_requested') then raise exception 'returns are only possible after delivery'; end if;
  if now() > v_o.delivered_at + make_interval(days => v_set.return_window_days) then raise exception 'return window has closed'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'reason required'; end if;
  select coalesce(sum(quantity),0) into v_used from public.returns
   where order_item_id = p_order_item_id and return_status <> 'rejected';
  if p_quantity < 1 or v_used + p_quantity > v_i.quantity then raise exception 'invalid return quantity'; end if;
  insert into public.returns(order_id, order_item_id, return_reason, quantity, requested_by)
  values (v_o.id, p_order_item_id, left(p_reason,500), p_quantity, auth.uid()) returning id into v_id;
  if v_o.order_status = 'delivered' then
    perform public.assert_transition('delivered','return_requested');
    update public.orders set order_status='return_requested' where id = v_o.id;
  end if;
  perform public.write_audit('return_requested','return',v_id,'{}');
  return v_id;
end $$;

create or replace function public.decide_return(p_return_id uuid, p_approve boolean,
  p_restock boolean default false, p_refund_amount numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_r public.returns%rowtype; v_i public.order_items%rowtype; v_o public.orders%rowtype;
  v_c public.sales_commissions%rowtype; v_prior numeric(12,2); v_amt numeric(12,2); v_q numeric(12,2); v_refund numeric(12,2);
begin
  perform public.require_admin();
  select * into v_r from public.returns where id = p_return_id for update;
  if not found or v_r.return_status <> 'requested' then raise exception 'return is not awaiting a decision'; end if;
  select * into v_o from public.orders where id = v_r.order_id for update;
  select * into v_i from public.order_items where id = v_r.order_item_id;
  if not p_approve then
    update public.returns set return_status='rejected', approved_by=auth.uid() where id = p_return_id;
    if v_o.order_status = 'return_requested'
       and not exists (select 1 from public.returns where order_id=v_o.id and return_status='requested') then
      perform public.assert_transition('return_requested','delivered');
      update public.orders set order_status='delivered' where id = v_o.id;
    end if;
    perform public.write_audit('return_rejected','return',p_return_id,'{}');
    return;
  end if;
  v_refund := coalesce(p_refund_amount, round(v_i.unit_price * v_r.quantity, 2));
  if v_refund > round(v_i.unit_price * v_r.quantity, 2) then raise exception 'refund exceeds item value'; end if;
  update public.returns set return_status='approved', approved_by=auth.uid(), refund_amount=v_refund, restock=p_restock
   where id = p_return_id;
  if v_o.order_status = 'return_requested' then
    perform public.assert_transition('return_requested','returned');
    update public.orders set order_status='returned' where id = v_o.id;
  end if;
  if p_restock and exists (select 1 from public.products where id=v_i.product_id and stock_tracking_enabled) then
    update public.products set stock_quantity = stock_quantity + v_r.quantity where id = v_i.product_id;
    insert into public.inventory_movements(product_id, movement_type, quantity, reference_type, reference_id, created_by)
    values (v_i.product_id,'return_restock',v_r.quantity,'return',p_return_id,auth.uid());
  end if;
  -- reverse the commission proportionally (a negative adjustment row; nothing is edited or deleted)
  select * into v_c from public.sales_commissions where order_item_id = v_i.id and reversal_of_commission_id is null;
  if found then
    select coalesce(sum(commission_amount),0) into v_prior from public.sales_commissions where reversal_of_commission_id = v_c.id;
    if (select coalesce(sum(quantity),0) from public.returns where order_item_id=v_i.id and return_status in ('approved','refunded')) >= v_i.quantity then
      v_amt := -(v_c.commission_amount + v_prior);             -- final piece: exact remainder
      v_q := -(v_c.qualifying_sales_amount + coalesce((select sum(qualifying_sales_amount) from public.sales_commissions where reversal_of_commission_id=v_c.id),0));
    else
      v_amt := -round(v_c.commission_amount * v_r.quantity / v_i.quantity, 2);
      v_q := -round(v_c.qualifying_sales_amount * v_r.quantity / v_i.quantity, 2);
    end if;
    insert into public.sales_commissions(order_id, order_item_id, distributor_id, commission_rule_id, qualifying_sales_amount,
        commission_rate_snapshot, commission_amount, calculation_basis, commission_status, reversal_of_commission_id, return_id)
    values (v_c.order_id, v_c.order_item_id, v_c.distributor_id, v_c.commission_rule_id, v_q, v_c.commission_rate_snapshot,
        v_amt, 'reversal for approved return', case when v_c.commission_status='approved' then 'approved' else 'pending' end, v_c.id, p_return_id);
  end if;
  perform public.write_audit('return_approved','return',p_return_id,jsonb_build_object('refund',v_refund));
end $$;

create or replace function public.record_refund(p_return_id uuid, p_refund_reference text) returns void
language plpgsql security definer set search_path = public as $$
declare v_r public.returns%rowtype; v_o public.orders%rowtype; v_total numeric(12,2);
begin
  perform public.require_admin();
  if coalesce(p_refund_reference,'') = '' then raise exception 'refund reference required'; end if;
  select * into v_r from public.returns where id = p_return_id for update;
  if not found or v_r.return_status <> 'approved' then raise exception 'return is not approved for refund'; end if;
  select * into v_o from public.orders where id = v_r.order_id for update;
  update public.returns set return_status='refunded', refund_reference=p_refund_reference where id = p_return_id;
  if v_o.order_status = 'returned' then
    perform public.assert_transition('returned','refund_pending');
    perform public.assert_transition('refund_pending','refunded');
    update public.orders set order_status='refunded' where id = v_o.id;
  end if;
  select coalesce(sum(refund_amount),0) into v_total from public.returns where order_id = v_o.id and return_status='refunded';
  update public.orders set payment_status = case when v_total >= v_o.total_amount then 'refunded' else 'partially_refunded' end
   where id = v_o.id;
  perform public.write_audit('refund_recorded','return',p_return_id,jsonb_build_object('amount',v_r.refund_amount));
end $$;

-- ---------- Payouts ----------
create or replace function public.distributor_payable_balance(p_distributor_id uuid) returns numeric
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or p_distributor_id = public.current_distributor_id()) then
    raise exception 'not allowed' using errcode='42501'; end if;
  return coalesce((select sum(commission_amount) from public.sales_commissions
                    where distributor_id=p_distributor_id and commission_status='approved'),0)
       - coalesce((select sum(amount) from public.payouts
                    where distributor_id=p_distributor_id and payout_status in ('pending_approval','approved','paid')),0);
end $$;

create or replace function public.request_payout(p_distributor_id uuid, p_amount numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_set public.company_settings%rowtype; v_id uuid;
begin
  perform public.require_admin();
  select * into v_set from public.company_settings;
  if not v_set.live_commission_enabled or v_set.compliance_review_status <> 'approved' then
    raise exception 'payouts are disabled until the compliance review is approved'; end if;
  perform 1 from public.distributors where id = p_distributor_id and application_status='approved' for update; -- serialises payouts per distributor
  if not found then raise exception 'distributor not approved'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;
  if p_amount > public.distributor_payable_balance(p_distributor_id) then raise exception 'amount exceeds approved available balance'; end if;
  insert into public.payouts(distributor_id, amount, created_by) values (p_distributor_id, p_amount, auth.uid()) returning id into v_id;
  perform public.write_audit('payout_requested','payout',v_id,jsonb_build_object('amount',p_amount));
  return v_id;
end $$;

create or replace function public.approve_payout(p_payout_id uuid, p_approval_reference text) returns void
language plpgsql security definer set search_path = public as $$
declare v_p public.payouts%rowtype;
begin
  perform public.require_admin();
  if coalesce(p_approval_reference,'') = '' then raise exception 'approval reference required'; end if;
  select * into v_p from public.payouts where id=p_payout_id for update;
  if not found or v_p.payout_status <> 'pending_approval' then raise exception 'payout is not awaiting approval'; end if;
  perform 1 from public.distributors where id = v_p.distributor_id for update;
  if public.distributor_payable_balance(v_p.distributor_id) < 0 then raise exception 'balance no longer covers this payout'; end if;
  update public.payouts set payout_status='approved', approval_reference=p_approval_reference, approved_by=auth.uid() where id=p_payout_id;
  perform public.write_audit('payout_approved','payout',p_payout_id,'{}');
end $$;

create or replace function public.mark_payout_paid(p_payout_id uuid, p_payment_reference text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if coalesce(p_payment_reference,'') = '' then raise exception 'payment reference required'; end if;
  update public.payouts set payout_status='paid', payment_reference=p_payment_reference, paid_at=now()
   where id=p_payout_id and payout_status='approved';
  if not found then raise exception 'payout is not approved'; end if;
  perform public.write_audit('payout_paid','payout',p_payout_id,'{}');
end $$;

create or replace function public.fail_or_reverse_payout(p_payout_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_s text;
begin
  perform public.require_admin();
  select payout_status into v_s from public.payouts where id=p_payout_id for update;
  if v_s in ('pending_approval','approved') then
    update public.payouts set payout_status='failed', failure_reason=left(p_reason,300) where id=p_payout_id;
  elsif v_s = 'paid' then
    update public.payouts set payout_status='reversed', failure_reason=left(p_reason,300) where id=p_payout_id;
  else raise exception 'payout cannot be failed or reversed'; end if;
  perform public.write_audit('payout_failed_or_reversed','payout',p_payout_id,'{}');
end $$;

-- ---------- Distributors ----------
create or replace function public.apply_distributor(p_sponsor_code text, p_agreement_version text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_sp uuid; v_id uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not exists (select 1 from public.profiles where id=v_uid and account_status='active') then raise exception 'account is not active'; end if;
  if coalesce(p_agreement_version,'') = '' then raise exception 'agreement must be accepted'; end if;
  if p_sponsor_code is not null and p_sponsor_code <> '' then
    select id into v_sp from public.distributors where distributor_code=upper(p_sponsor_code) and application_status='approved';
  end if;
  insert into public.distributors(profile_id, sponsor_distributor_id, agreement_version, agreement_accepted_at)
  values (v_uid, v_sp, p_agreement_version, now()) returning id into v_id;   -- no fee, no purchase required
  insert into public.policy_acceptances(profile_id, policy_name, policy_version) values (v_uid,'distributor_agreement',p_agreement_version)
  on conflict do nothing;
  perform public.write_audit('distributor_applied','distributor',v_id,'{}');
  return v_id;
end $$;

create or replace function public.review_distributor(p_distributor_id uuid, p_decision text) returns void
language plpgsql security definer set search_path = public as $$
declare v_d public.distributors%rowtype; v_code text; v_try int := 0;
begin
  perform public.require_admin();
  if p_decision not in ('approve','reject','suspend') then raise exception 'invalid decision'; end if;
  select * into v_d from public.distributors where id=p_distributor_id for update;
  if not found then raise exception 'distributor not found'; end if;
  if p_decision = 'approve' then
    v_code := v_d.distributor_code;
    while v_code is null loop
      v_code := 'MH' || upper(substr(md5(random()::text || clock_timestamp()::text),1,6));
      v_try := v_try + 1;
      if exists (select 1 from public.distributors where distributor_code = v_code) then v_code := null; end if;
      if v_try > 20 then raise exception 'could not generate a unique code'; end if;
    end loop;
    update public.distributors set application_status='approved', distributor_code=v_code, approved_at=coalesce(approved_at,now()), approved_by=auth.uid() where id=p_distributor_id;
    update public.profiles set role='distributor' where id=v_d.profile_id and role='customer';
  elsif p_decision = 'reject' then
    update public.distributors set application_status='rejected' where id=p_distributor_id;
  else
    update public.distributors set application_status='suspended' where id=p_distributor_id;
  end if;
  perform public.write_audit('distributor_'||p_decision,'distributor',p_distributor_id,'{}');
end $$;

-- ---------- Inventory ----------
create or replace function public.receive_stock(p_product_id uuid, p_quantity int, p_invoice_ref text,
  p_batch text default null, p_expiry date default null, p_unit_cost numeric default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  if p_quantity is null or p_quantity <= 0 then raise exception 'quantity must be positive'; end if;
  update public.products set stock_quantity = stock_quantity + p_quantity where id = p_product_id;
  if not found then raise exception 'product not found'; end if;
  insert into public.inventory_movements(product_id, movement_type, quantity, supplier_invoice_ref, batch_number, expiry_date, unit_cost, created_by)
  values (p_product_id,'purchase_receipt',p_quantity,p_invoice_ref,p_batch,p_expiry,p_unit_cost,auth.uid());
  perform public.write_audit('stock_received','product',p_product_id,jsonb_build_object('qty',p_quantity));
end $$;

create or replace function public.adjust_stock(p_product_id uuid, p_delta int, p_type text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  if p_type not in ('damaged','adjustment') or p_delta is null or p_delta = 0 then raise exception 'invalid adjustment'; end if;
  if p_type = 'damaged' and p_delta > 0 then raise exception 'damaged stock must be negative'; end if;
  update public.products set stock_quantity = stock_quantity + p_delta where id = p_product_id; -- CHECK blocks negatives
  if not found then raise exception 'product not found'; end if;
  insert into public.inventory_movements(product_id, movement_type, quantity, note, created_by)
  values (p_product_id,p_type,p_delta,left(p_note,300),auth.uid());
  perform public.write_audit('stock_adjusted','product',p_product_id,jsonb_build_object('delta',p_delta));
end $$;

-- ---------- Complaints & roles ----------
create or replace function public.create_complaint(p_order_id uuid, p_subject text, p_description text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_c uuid := public.current_customer_id(); v_id uuid;
begin
  if v_c is null then raise exception 'customer account required' using errcode='42501'; end if;
  if p_order_id is not null and not exists (select 1 from public.orders where id=p_order_id and customer_id=v_c) then
    raise exception 'order not found'; end if;
  if coalesce(trim(p_subject),'')='' or coalesce(trim(p_description),'')='' then raise exception 'subject and description required'; end if;
  insert into public.complaints(customer_id, order_id, complaint_number, subject, description)
  values (v_c, p_order_id, 'CMP-' || nextval('public.complaint_number_seq'), left(p_subject,200), left(p_description,4000))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.update_complaint(p_id uuid, p_status text, p_notes text, p_assigned_to uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  if p_status not in ('open','in_progress','resolved','closed') then raise exception 'invalid status'; end if;
  update public.complaints set status=p_status, resolution_notes=coalesce(p_notes,resolution_notes),
     assigned_to=coalesce(p_assigned_to,assigned_to),
     resolved_at = case when p_status in ('resolved','closed') then coalesce(resolved_at,now()) else null end
   where id=p_id;
  if not found then raise exception 'complaint not found'; end if;
  perform public.write_audit('complaint_updated','complaint',p_id,jsonb_build_object('status',p_status));
end $$;

create or replace function public.admin_set_role(p_profile_id uuid, p_role text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p_profile_id = auth.uid() then raise exception 'you cannot change your own role or status'; end if;
  if p_role not in ('customer','distributor','staff','admin') or p_status not in ('active','suspended','closed') then
    raise exception 'invalid role or status'; end if;
  update public.profiles set role=p_role, account_status=p_status where id=p_profile_id;
  if not found then raise exception 'profile not found'; end if;
  perform public.write_audit('role_changed','profile',p_profile_id,jsonb_build_object('role',p_role,'status',p_status));
end $$;
