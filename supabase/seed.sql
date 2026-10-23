-- DEMO DATA ONLY. Never load into a production database. All names are labelled [DEMO].
insert into public.categories(category_name, description) values ('[DEMO] General','Demo category') on conflict do nothing;
insert into public.products(category_id, sku, product_name, description, mrp, selling_price, purchase_cost,
  applicable_tax_configuration, stock_quantity, active)
select id, 'DEMO-001', '[DEMO] Sample product A', 'Demo only, not a real product', 120, 100, 60, '{"gst_rate":5,"inclusive":true}', 20, true
from public.categories where category_name='[DEMO] General'
on conflict (sku) do nothing;
