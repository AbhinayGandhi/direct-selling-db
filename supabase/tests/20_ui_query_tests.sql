-- Runs the same table access the admin/distributor screens use, under each role. Needs 10_db_tests.sql data first.
\set ON_ERROR_STOP off
truncate tt.results;
select tt.as_user('a0000000-0000-0000-0000-000000000001');
insert into public.categories(category_name) values ('UI-cat');
insert into public.suppliers(supplier_name) values ('UI-sup');
insert into public.products(sku,product_name,mrp,selling_price,purchase_cost,applicable_tax_configuration,image_path,stock_tracking_enabled,low_stock_threshold,active,category_id,supplier_id)
  select 'UI-1','UI product',50,40,20,'{"gst_rate":12,"inclusive":true}',null,true,3,false,(select id from public.categories where category_name='UI-cat'),(select id from public.suppliers limit 1);
select tt.ok('admin can add category, supplier, product', (select count(*) from public.products where sku='UI-1')=1);
update public.products set selling_price=45, active=true where sku='UI-1';
select tt.ok('admin can edit product price and activate', (select selling_price from public.products where sku='UI-1')=45 and (select active from public.products where sku='UI-1'));
select tt.denied('admin cannot edit stock directly', 'update public.products set stock_quantity=500 where sku=''UI-1''');
update public.company_settings set legal_business_name='Test Co', support_phone='9999999999', delivery_charge=40, free_delivery_above=500 where id;
select tt.ok('admin can edit company settings', (select legal_business_name from public.company_settings)='Test Co');
select tt.ok('admin can read distributors with profile names', (select count(*) from public.distributors d join public.profiles p on p.id=d.profile_id)>=2);
select tt.ok('admin can read sales_commissions', (select count(*) from public.sales_commissions)>=1);
select tt.ok('admin can list all profiles', (select count(*) from public.profiles)>=6);
select tt.su();

select tt.as_user('a0000000-0000-0000-0000-000000000002');
select tt.ok('staff can read products incl. stock', (select count(*) from public.products)>=3);
update public.products set selling_price=1;  -- RLS silently matches 0 rows
select tt.ok('staff product edit changed nothing', (select count(*) from public.products where selling_price=1)=0);
update public.company_settings set support_phone='1';  -- RLS silently matches 0 rows
select tt.ok('staff cannot read company_settings rows', (select count(*) from public.company_settings)=0);
select tt.ok('staff cannot read sales_commissions', (select count(*) from public.sales_commissions)=0);
select tt.ok('staff cannot read payouts', (select count(*) from public.payouts)=0);
select tt.ok('staff can read orders and complaints', (select count(*) from public.orders)>=1 and (select count(*) from public.complaints)>=1);
select tt.denied('staff cannot receive negative stock', format('select public.receive_stock(%L,-5,''x'')', tt.get('p1')));
select public.receive_stock(tt.get('p1')::uuid, 5, 'INV-1');
select tt.ok('staff can receive stock', (select count(*) from public.inventory_movements where movement_type='purchase_receipt')=1);
select tt.su();
select tt.ok('staff company-settings edit changed nothing', (select support_phone from public.company_settings)='9999999999');

select tt.as_user('d0000000-0000-0000-0000-000000000001');
select tt.ok('distributor sees own distributor row only', (select count(*) from public.distributors)=1);
select tt.ok('distributor can read distributor_sales view', (select count(*) from public.distributor_sales)>=1);
select tt.ok('distributor sees public company info', (select legal_business_name from public.public_company_info)='Test Co');
select tt.ok('distributor sees approved rule only', (select count(*) from public.commission_rules where approved_by is not null)>=1);
select tt.denied('distributor cannot read suppliers', 'insert into public.suppliers(supplier_name) values (''x'')');
select tt.ok('distributor sees no products rows (cost hidden)', (select count(*) from public.products)=0);
select tt.su();

select tt.as_user('c0000000-0000-0000-0000-000000000001');
select tt.ok('customer sees own complaints only', (select count(*) from public.complaints)=1);
select tt.ok('customer sees no suppliers', (select count(*) from public.suppliers)=0);
select tt.ok('customer sees no payouts/commissions', (select count(*) from public.payouts)=0 and (select count(*) from public.sales_commissions)=0);
select tt.ok('customer cannot see other profiles', (select count(*) from public.profiles)=1);
select tt.su();
select case when passed then 'PASS' else 'FAIL' end r, name from tt.results order by passed, name;
select count(*) filter (where passed) passed, count(*) filter (where not passed) failed from tt.results;
