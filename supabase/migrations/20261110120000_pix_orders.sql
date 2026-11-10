-- Checkout Transparente (API Orders, só Pix): o pedido guarda o QR code para a página de pagamento
alter table public.orders add column if not exists mp_order    text;
alter table public.orders add column if not exists pix_code    text;
alter table public.orders add column if not exists pix_image   text;
alter table public.orders add column if not exists pix_url     text;
alter table public.orders add column if not exists pix_expires timestamptz;
alter table public.orders drop column if exists mp_preference;
create index if not exists orders_mp_order_idx on public.orders(mp_order);

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('PENDING','PAID','REFUNDED','EXPIRED'));

-- PIX vencido ou cancelado antes de ser pago
create or replace function public.gd_mark_expired(p_order text)
returns void language sql as $$
  update public.orders set status = 'EXPIRED' where id = p_order and status = 'PENDING';
$$;
revoke all on function public.gd_mark_expired(text) from public, anon, authenticated;
