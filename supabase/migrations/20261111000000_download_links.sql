-- Links de download temporários (enviados por e-mail e mostrados na página de pagamento)
create table if not exists public.download_links (
  token       text primary key,
  order_id    text not null references public.orders(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  downloads   integer not null default 0
);
create index if not exists download_links_order_idx on public.download_links(order_id, created_at desc);
alter table public.download_links enable row level security;

create index if not exists orders_email_idx on public.orders(lower(email));

alter table public.orders add column if not exists refunded_at timestamptz;

create or replace function public.gd_mark_refunded(p_order text)
returns void language sql as $$
  update public.orders set status = 'REFUNDED', refunded_at = now() where id = p_order and status <> 'REFUNDED';
  update public.commissions set status = 'VOID' where order_id = p_order and status = 'HOLD';
$$;

create or replace function public.gd_link_download(p_token text)
returns void language sql as $$
  update public.download_links set downloads = downloads + 1 where token = p_token;
$$;
revoke all on function public.gd_link_download(text), public.gd_mark_refunded(text) from public, anon, authenticated;
