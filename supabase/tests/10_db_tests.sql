-- Local test suite. Run AFTER the stub + all migrations, on a throwaway database.
\set ON_ERROR_STOP on
create schema tt;
grant usage on schema tt to public;
create table tt.results(name text, passed boolean);
create table tt.ctx(k text primary key, v text);
grant all on tt.results, tt.ctx to public;

create function tt.ok(p_name text, p_cond boolean) returns void language plpgsql as $$
begin insert into tt.results values (p_name, coalesce(p_cond,false)); end $$;
create function tt.put(k text, v text) returns void language sql as $$ insert into tt.ctx values (k,v) on conflict (k) do update set v=excluded.v $$;
create function tt.get(p_k text) returns text language sql as $$ select v from tt.ctx where k=p_k $$;
create function tt.as_user(p_uid text, p_role text default 'authenticated') returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p_uid,''), false);
      perform set_config('request.jwt.claim.role', p_role, false);
      execute format('set role %I', case when p_role='service_role' then 'authenticated' else p_role end); end $$;
create function tt.su() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub','',false); perform set_config('request.jwt.claim.role','',false); end $$;
-- expect the statement to raise an error
create function tt.denied(p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql; insert into tt.results values (p_name, false);
  exception when others then insert into tt.results values (p_name, true); end;
end $$;
grant execute on all functions in schema tt to public;

-- ---------- fixtures (superuser) ----------
insert into auth.users(id,email,raw_user_meta_data) values
 ('a0000000-0000-0000-0000-000000000001','admin@t.test','{"full_name":"Admin","role":"admin"}'),
 ('a0000000-0000-0000-0000-000000000002','staff@t.test','{}'),
 ('c0000000-0000-0000-0000-000000000001','c1@t.test','{}'),
 ('c0000000-0000-0000-0000-000000000002','c2@t.test','{}'),
 ('d0000000-0000-0000-0000-000000000001','d1@t.test','{}'),
 ('d0000000-0000-0000-0000-000000000002','d2@t.test','{}');
select tt.ok('signup ignores role in client metadata', (select role from profiles where id='a0000000-0000-0000-0000-000000000001')='customer');
update profiles set role='admin' where id='a0000000-0000-0000-0000-000000000001';
update profiles set role='staff' where id='a0000000-0000-0000-0000-000000000002';
update company_settings set live_sales_enabled=true;
insert into categories(category_name) values ('Demo');
insert into products(sku,product_name,mrp,selling_price,purchase_cost,applicable_tax_configuration,stock_quantity,active)
 values ('P1','Demo incl GST',120,105,60,'{"gst_rate":5,"inclusive":true}',10,true),
        ('P2','Demo excl GST',120,100,50,'{"gst_rate":18,"inclusive":false}',5,true);
select tt.put('p1',(select id::text from products where sku='P1'));
select tt.put('p2',(select id::text from products where sku='P2'));

-- ---------- anonymous ----------
select tt.as_user('', 'anon');
select tt.denied('anon cannot read orders','select * from public.orders');
select tt.denied('anon cannot read profiles','select * from public.profiles');
select tt.denied('anon cannot read commissions','select * from public.sales_commissions');
select tt.denied('anon cannot read company_settings table','select * from public.company_settings');
select tt.denied('anon cannot see purchase_cost','select purchase_cost from public.public_products');
select tt.denied('anon cannot create orders','select public.create_order(''[]''::jsonb,''{}''::jsonb,''manual_upi'',''abcdefgh'')');
select tt.ok('anon sees 2 active products', (select count(*) from public.public_products)=2);
select tt.su();

-- ---------- privilege escalation attempts (customer C1) ----------
select tt.as_user('c0000000-0000-0000-0000-000000000001');
select tt.denied('customer cannot set own role','update public.profiles set role=''admin'' where id=auth.uid()');
select tt.denied('customer cannot set own status','update public.profiles set account_status=''active'' where id=auth.uid()');
select tt.denied('customer cannot call admin_set_role','select public.admin_set_role(auth.uid(),''admin'',''active'')');
select tt.denied('customer cannot approve distributor','select public.review_distributor(gen_random_uuid(),''approve'')');
select tt.denied('customer cannot create commission rule','select public.create_commission_rule(''x'',0.1,current_date)');
select tt.denied('customer cannot change stock','update public.products set stock_quantity=999');
select tt.denied('customer cannot insert product','insert into public.products(sku,product_name,mrp,selling_price) values (''X'',''x'',1,1)');
select tt.ok('customer sees zero audit logs (RLS)', (select count(*) from public.audit_logs)=0);
select tt.denied('customer cannot read idempotency keys','select * from public.idempotency_keys');
update public.profiles set full_name='Customer One' where id=auth.uid();
select tt.ok('customer can edit own name',(select full_name from public.profiles where id=auth.uid())='Customer One');
select tt.su();

-- ---------- ordering ----------
select tt.as_user('c0000000-0000-0000-0000-000000000001');
select tt.put('ship','{"name":"C One","phone":"9999999999","address_line":"1 Main Rd","city":"Pune","state":"Maharashtra","pincode":"411001"}');
select tt.put('o1', public.create_order(
  format('[{"product_id":"%s","quantity":2},{"product_id":"%s","quantity":1}]', tt.get('p1'), tt.get('p2'))::jsonb,
  tt.get('ship')::jsonb, 'manual_upi', 'key-order-0001')::text);
select tt.put('o1_again', public.create_order(
  format('[{"product_id":"%s","quantity":2},{"product_id":"%s","quantity":1}]', tt.get('p1'), tt.get('p2'))::jsonb,
  tt.get('ship')::jsonb, 'manual_upi', 'key-order-0001')::text);
select tt.ok('duplicate submit returns same order', tt.get('o1')=tt.get('o1_again'));
select tt.ok('only one order exists after duplicate submit', (select count(*) from public.orders)=1);
select tt.denied('bad pincode rejected', format('select public.create_order(%L::jsonb,%L::jsonb,''manual_upi'',''key-order-bad1'')',
  format('[{"product_id":"%s","quantity":1}]',tt.get('p1')), '{"name":"a","phone":"1","address_line":"x","city":"y","state":"z","pincode":"123"}'));
select tt.denied('over-stock rejected', format('select public.create_order(%L::jsonb,%L::jsonb,''manual_upi'',''key-order-big1'')',
  format('[{"product_id":"%s","quantity":99}]',tt.get('p1')), tt.get('ship')));
select tt.denied('client cannot pick price (no such param; direct insert blocked)','insert into public.order_items(order_id,product_id,product_name_snapshot,sku_snapshot,quantity,unit_price,unit_cost_snapshot,tax_snapshot,line_total) values (gen_random_uuid(),gen_random_uuid(),''x'',''x'',1,1,1,''{}'',1)');
select tt.su();
select tt.ok('stock deducted exactly once (P1 10->8)', (select stock_quantity from products where sku='P1')=8);
select tt.ok('stock deducted exactly once (P2 5->4)', (select stock_quantity from products where sku='P2')=4);
select tt.ok('server totals: subtotal 310', (select subtotal from orders where id=tt.get('o1')::uuid)=310.00);
select tt.ok('server totals: tax 28 (10 incl + 18 excl)', (select tax_amount from orders where id=tt.get('o1')::uuid)=28.00);
select tt.ok('server totals: total 328', (select total_amount from orders where id=tt.get('o1')::uuid)=328.00);
select tt.ok('manual payment starts pending_verification', (select payment_status from orders where id=tt.get('o1')::uuid)='pending_verification');
select tt.ok('inventory movements recorded', (select count(*) from inventory_movements where movement_type='sale')=2);

-- isolation between customers
select tt.as_user('c0000000-0000-0000-0000-000000000002');
select tt.ok('C2 cannot see C1 orders', (select count(*) from public.orders)=0);
select tt.ok('C2 cannot see C1 order items', (select count(*) from public.order_items)=0);
select tt.ok('C2 cannot see C1 payments', (select count(*) from public.payments)=0);
select tt.denied('C2 cannot cancel C1 order', format('select public.cancel_my_order(%L,''x'')', tt.get('o1')));
select tt.su();
select tt.as_user('c0000000-0000-0000-0000-000000000001');
select tt.ok('C1 sees own order', (select count(*) from public.orders)=1);
select tt.denied('customer cannot confirm own payment', format('select public.confirm_payment(%L)', tt.get('o1')));
select tt.denied('customer cannot change order status', format('select public.update_order_status(%L,''confirmed'')', tt.get('o1')));
select tt.su();

-- payment + lifecycle (staff)
select tt.as_user('a0000000-0000-0000-0000-000000000002');
select public.confirm_payment(tt.get('o1')::uuid, 'UPI-REF-1');
select tt.ok('staff payment confirmation confirms order', (select order_status||'/'||payment_status from public.orders where id=tt.get('o1')::uuid)='confirmed/paid');
select tt.denied('cannot skip states (confirmed->delivered)', format('select public.update_order_status(%L,''delivered'')', tt.get('o1')));
select tt.denied('staff cannot approve refunds', 'select public.decide_return(gen_random_uuid(),true)');
select tt.denied('staff cannot request payout', 'select public.request_payout(gen_random_uuid(),1)');
select tt.denied('staff cannot change roles', 'select public.admin_set_role(gen_random_uuid(),''admin'',''active'')');
select tt.ok('staff sees zero audit logs (RLS)', (select count(*) from public.audit_logs)=0);
select public.update_order_status(tt.get('o1')::uuid,'processing');
select public.update_order_status(tt.get('o1')::uuid,'shipped','DTDC','TRK123');
select public.update_order_status(tt.get('o1')::uuid,'delivered');
select tt.su();
select tt.ok('no commission while live_commission disabled', (select count(*) from sales_commissions)=0);

-- compliance guard
select tt.denied('cannot enable commissions before compliance approval', 'update company_settings set live_commission_enabled=true');
select tt.as_user('a0000000-0000-0000-0000-000000000001');
select tt.denied('payout blocked before compliance approval', 'select public.request_payout(gen_random_uuid(),1)');
select tt.su();

-- cancellation restores stock
select tt.as_user('c0000000-0000-0000-0000-000000000002');
select tt.put('o_cancel', public.create_order(format('[{"product_id":"%s","quantity":3}]',tt.get('p1'))::jsonb, tt.get('ship')::jsonb,'cash_on_delivery','key-order-0002')::text);
select public.cancel_my_order(tt.get('o_cancel')::uuid,'changed mind');
select tt.su();
select tt.ok('cancel restores stock back to 8', (select stock_quantity from products where sku='P1')=8);
select tt.ok('cancelled order status', (select order_status from orders where id=tt.get('o_cancel')::uuid)='cancelled');

-- ---------- distributors ----------
select tt.as_user('d0000000-0000-0000-0000-000000000001');
select tt.put('dist1', public.apply_distributor(null,'v1-draft')::text);
select tt.denied('applicant cannot approve self', format('select public.review_distributor(%L,''approve'')', tt.get('dist1')));
select tt.denied('applicant cannot self-edit status', 'update public.distributors set application_status=''approved''');
select tt.su();
select tt.as_user('d0000000-0000-0000-0000-000000000002');
select tt.put('dist2', public.apply_distributor(null,'v1-draft')::text);
select tt.su();
select tt.as_user('a0000000-0000-0000-0000-000000000001');
select public.review_distributor(tt.get('dist1')::uuid,'approve');
select public.review_distributor(tt.get('dist2')::uuid,'approve');
select tt.put('code1',(select distributor_code from public.distributors where id=tt.get('dist1')::uuid));
select tt.su();
select tt.ok('approved distributor gets code and role', (select count(*) from profiles where id='d0000000-0000-0000-0000-000000000001' and role='distributor')=1);

-- enable commissions after (simulated) reviewer sign-off
update company_settings set compliance_review_status='approved', live_commission_enabled=true;
select tt.as_user('a0000000-0000-0000-0000-000000000001');
select tt.put('rule', public.create_commission_rule('Direct sales 10%',0.10,current_date)::text);
select tt.ok('unapproved rule not active', (select active from public.commission_rules where id=tt.get('rule')::uuid)=false);
select public.approve_commission_rule(tt.get('rule')::uuid);
select tt.su();

-- order via distributor code; self-referral earns nothing
select tt.as_user('c0000000-0000-0000-0000-000000000001');
select tt.put('o2', public.create_order(format('[{"product_id":"%s","quantity":2}]',tt.get('p1'))::jsonb, tt.get('ship')::jsonb,'manual_upi','key-order-0003', tt.get('code1'))::text);
select tt.su();
select tt.as_user('d0000000-0000-0000-0000-000000000001');
select tt.put('o_self', public.create_order(format('[{"product_id":"%s","quantity":1}]',tt.get('p1'))::jsonb, tt.get('ship')::jsonb,'manual_upi','key-order-0004', tt.get('code1'))::text);
select tt.su();
select tt.ok('self-referral order has no attribution', (select attributed_distributor_id from orders where id=tt.get('o_self')::uuid) is null);
select tt.ok('code attributes order on server', (select attributed_distributor_id from orders where id=tt.get('o2')::uuid)=tt.get('dist1')::uuid);

select tt.as_user('a0000000-0000-0000-0000-000000000002');
select public.confirm_payment(tt.get('o2')::uuid,'UPI-REF-2');
select public.update_order_status(tt.get('o2')::uuid,'processing');
select public.update_order_status(tt.get('o2')::uuid,'shipped');
select public.update_order_status(tt.get('o2')::uuid,'delivered');
select tt.su();
select tt.ok('commission = (210-10 GST) x 10% = 20.00', (select commission_amount from sales_commissions where order_id=tt.get('o2')::uuid)=20.00);
select tt.ok('commission snapshot rate', (select commission_rate_snapshot from sales_commissions where order_id=tt.get('o2')::uuid)=0.10);
select tt.ok('commission base excludes GST', (select qualifying_sales_amount from sales_commissions where order_id=tt.get('o2')::uuid)=200.00);
select public._generate_commissions(tt.get('o2')::uuid);
select tt.ok('no duplicate commission on re-run', (select count(*) from sales_commissions where order_id=tt.get('o2')::uuid)=1);
select tt.ok('no commission on sponsor-less/unattributed orders', (select count(*) from sales_commissions where order_id=tt.get('o1')::uuid)=0);
select tt.denied('commissions cannot be deleted', 'delete from sales_commissions');
select tt.denied('audit logs cannot be edited', 'update audit_logs set action=''x''');
select tt.denied('audit logs cannot be deleted', 'delete from audit_logs');
select tt.denied('orders cannot be deleted', 'delete from orders');

-- distributor visibility
select tt.as_user('d0000000-0000-0000-0000-000000000001');
select tt.ok('D1 sees own commission', (select count(*) from public.sales_commissions)=1);
select tt.ok('D1 sales view shows attributed order', (select count(*) from public.distributor_sales)=1);
select tt.denied('D1 sales view has no shipping/customer data','select shipping_details from public.distributor_sales');
select tt.ok('D1 cannot read customers table rows of others', (select count(*) from public.customers where profile_id<>auth.uid())=0);
select tt.ok('D1 cannot read others orders', (select count(*) from public.orders where id=tt.get('o2')::uuid)=0);
select tt.denied('D1 cannot approve own commission', 'select public.approve_commissions(array(select id from public.sales_commissions))');
select tt.denied('D1 cannot update commission row','update public.sales_commissions set commission_amount=9999');
select tt.denied('D1 cannot insert commission','insert into public.sales_commissions(order_id,order_item_id,distributor_id,qualifying_sales_amount,commission_rate_snapshot,commission_amount) values (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1,1,1)');
select tt.su();
select tt.as_user('d0000000-0000-0000-0000-000000000002');
select tt.ok('D2 sees none of D1 commissions', (select count(*) from public.sales_commissions)=0);
select tt.ok('D2 sees no payouts', (select count(*) from public.payouts)=0);
select tt.denied('D2 cannot read D1 balance', format('select public.distributor_payable_balance(%L)', tt.get('dist1')));
select tt.su();

-- ---------- returns + commission reversal ----------
select tt.as_user('c0000000-0000-0000-0000-000000000001');
select tt.put('item2',(select id::text from public.order_items where order_id=tt.get('o2')::uuid));
select tt.put('ret1', public.request_return(tt.get('item2')::uuid,1,'damaged')::text);
select tt.put('ret2', public.request_return(tt.get('item2')::uuid,1,'wrong item')::text);
select tt.denied('cannot return more than purchased', format('select public.request_return(%L,1,''x'')', tt.get('item2')));
select tt.denied('customer cannot approve own return', format('select public.decide_return(%L,true)', tt.get('ret1')));
select tt.su();
select tt.as_user('a0000000-0000-0000-0000-000000000001');
select public.decide_return(tt.get('ret1')::uuid,true,true,null);
select tt.denied('return cannot be decided twice', format('select public.decide_return(%L,true)', tt.get('ret1')));
select public.decide_return(tt.get('ret2')::uuid,true,false,null);
select public.record_refund(tt.get('ret1')::uuid,'REFUND-1');
select public.record_refund(tt.get('ret2')::uuid,'REFUND-2');
select tt.su();
select tt.ok('reversal rows created (2)', (select count(*) from sales_commissions where reversal_of_commission_id is not null)=2);
select tt.ok('net commission after full return = 0.00', (select sum(commission_amount) from sales_commissions where order_id=tt.get('o2')::uuid)=0.00);
select tt.ok('first reversal proportional -10.00', (select commission_amount from sales_commissions where return_id=tt.get('ret1')::uuid)=-10.00);
select tt.ok('restocked 1 unit for ret1 only (8->... )', (select count(*) from inventory_movements where movement_type='return_restock')=1);
select tt.ok('order refunded', (select order_status from orders where id=tt.get('o2')::uuid)='refunded');
select tt.ok('original commission row untouched', (select commission_amount from sales_commissions where order_id=tt.get('o2')::uuid and reversal_of_commission_id is null)=20.00);

-- ---------- payouts ----------
select tt.as_user('c0000000-0000-0000-0000-000000000002');
select tt.put('o3', public.create_order(format('[{"product_id":"%s","quantity":2}]',tt.get('p1'))::jsonb, tt.get('ship')::jsonb,'bank_transfer','key-order-0005', tt.get('code1'))::text);
select tt.su();
select tt.as_user('a0000000-0000-0000-0000-000000000002');
select public.confirm_payment(tt.get('o3')::uuid,'BANK-3');
select public.update_order_status(tt.get('o3')::uuid,'processing');
select public.update_order_status(tt.get('o3')::uuid,'shipped');
select public.update_order_status(tt.get('o3')::uuid,'delivered');
select tt.su();
select tt.as_user('a0000000-0000-0000-0000-000000000001');
select tt.ok('approved balance is 0 before approval', public.distributor_payable_balance(tt.get('dist1')::uuid)=0);
select tt.denied('payout cannot exceed approved balance', format('select public.request_payout(%L,1)', tt.get('dist1')));
select public.approve_commissions(array(select id from public.sales_commissions where distributor_id=tt.get('dist1')::uuid and commission_status='pending'));
select tt.ok('approved balance = 20.00 (adjustments net out)', public.distributor_payable_balance(tt.get('dist1')::uuid)=20.00);
select tt.denied('payout over balance rejected', format('select public.request_payout(%L,25)', tt.get('dist1')));
select tt.put('pay1', public.request_payout(tt.get('dist1')::uuid,20)::text);
select tt.denied('duplicate payout blocked (balance already reserved)', format('select public.request_payout(%L,20)', tt.get('dist1')));
select tt.denied('mark paid before approval blocked', format('select public.mark_payout_paid(%L,''UTR1'')', tt.get('pay1')));
select public.approve_payout(tt.get('pay1')::uuid,'APPR-001');
select public.mark_payout_paid(tt.get('pay1')::uuid,'UTR1');
select tt.denied('cannot mark paid twice', format('select public.mark_payout_paid(%L,''UTR2'')', tt.get('pay1')));
select tt.ok('balance 0 after payout', public.distributor_payable_balance(tt.get('dist1')::uuid)=0);
select public.fail_or_reverse_payout(tt.get('pay1')::uuid,'bank returned');
select tt.ok('balance restored after reversed payout', public.distributor_payable_balance(tt.get('dist1')::uuid)=20.00);
select tt.su();
select tt.as_user('d0000000-0000-0000-0000-000000000001');
select tt.ok('distributor sees own payout history', (select count(*) from public.payouts)=1);
select tt.denied('distributor cannot request payout', format('select public.request_payout(%L,1)', tt.get('dist1')));
select tt.su();

-- ---------- online payment confirmation ----------
select tt.as_user('c0000000-0000-0000-0000-000000000002');
select tt.put('o4', public.create_order(format('[{"product_id":"%s","quantity":1}]',tt.get('p2'))::jsonb, tt.get('ship')::jsonb,'online_provider','key-order-0006')::text);
select tt.su();
select tt.as_user('a0000000-0000-0000-0000-000000000002');
select tt.denied('staff cannot confirm online provider payment', format('select public.confirm_payment(%L,''X'')', tt.get('o4')));
select tt.su();
select tt.as_user('', 'service_role');
select tt.denied('provider confirmation needs a reference', format('select public.confirm_payment(%L)', tt.get('o4')));
select public.confirm_payment(tt.get('o4')::uuid,'PROVIDER-OK-1');
select tt.su();
select tt.ok('verified provider confirmation marks paid', (select payment_status from orders where id=tt.get('o4')::uuid)='paid');

-- ---------- complaints ----------
select tt.as_user('c0000000-0000-0000-0000-000000000001');
select tt.put('cmp', public.create_complaint(tt.get('o1')::uuid,'Late delivery','Not arrived')::text);
select tt.denied('cannot complain about others order', format('select public.create_complaint(%L,''x'',''y'')', tt.get('o_cancel')));
select tt.su();
select tt.as_user('c0000000-0000-0000-0000-000000000002');
select tt.ok('C2 cannot see C1 complaints', (select count(*) from public.complaints)=0);
select tt.su();
select tt.as_user('a0000000-0000-0000-0000-000000000002');
select public.update_complaint(tt.get('cmp')::uuid,'resolved','Re-shipped');
select tt.su();
select tt.ok('complaint resolved timestamp set', (select resolved_at is not null from complaints where id=tt.get('cmp')::uuid));

-- ---------- admin & audit ----------
select tt.as_user('a0000000-0000-0000-0000-000000000001');
select tt.denied('admin cannot change own role', 'select public.admin_set_role(auth.uid(),''customer'',''active'')');
select tt.ok('admin can read audit logs', (select count(*) from public.audit_logs)>10);
select tt.su();
select tt.ok('multi-level flag stays off', (select network_compensation_enabled=false from company_settings));

\echo ===== RESULTS =====
select case when passed then 'PASS' else 'FAIL' end as result, name from tt.results order by passed, name;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from tt.results;
