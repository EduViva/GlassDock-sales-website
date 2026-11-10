-- GlassDock: pedidos, indicadores, comissões e pagamentos das comissões
-- Só o servidor (chave secreta do Supabase) acessa estas tabelas: RLS ligado e nenhuma policy.

create table if not exists public.referrers (
  slug        text primary key,
  name        text not null,
  email       text not null unique,
  pix_key     text not null,
  pix_type    text not null check (pix_type in ('CPF','CNPJ','PHONE','EMAIL','RANDOM')),
  secret      text not null unique,
  clicks      integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.orders (
  id             text primary key,
  ref            text references public.referrers(slug) on update cascade,
  status         text not null default 'PENDING' check (status in ('PENDING','PAID','REFUNDED')),
  amount         integer not null,
  email          text,
  mp_preference  text,
  mp_payment     text,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz,
  downloads      integer not null default 0
);
create index if not exists orders_ref_idx on public.orders(ref);
create index if not exists orders_status_idx on public.orders(status);

create table if not exists public.payouts (
  id          text primary key default ('po_' || replace(gen_random_uuid()::text, '-', '')),
  slug        text not null references public.referrers(slug) on update cascade,
  amount      integer not null,
  pix_key     text not null,
  pix_type    text not null,
  note        text,
  created_at  timestamptz not null default now()
);

-- uma linha por venda indicada
-- HOLD: esperando a segunda-feira de pagamento · PAID: PIX enviado · VOID: reembolso ou compra pelo próprio link
create table if not exists public.commissions (
  order_id    text primary key references public.orders(id),
  slug        text not null references public.referrers(slug) on update cascade,
  amount      integer not null,
  status      text not null default 'HOLD' check (status in ('HOLD','PAID','VOID')),
  payout_on   date not null,
  payout_id   text references public.payouts(id),
  created_at  timestamptz not null default now()
);
create index if not exists commissions_slug_idx on public.commissions(slug);
create index if not exists commissions_due_idx on public.commissions(status, payout_on);

alter table public.referrers   enable row level security;
alter table public.orders      enable row level security;
alter table public.payouts     enable row level security;
alter table public.commissions enable row level security;

-- Primeira segunda-feira depois de completar 7 dias da compra (horário de Brasília)
-- Ex.: compra na segunda 10/11 → 7 dias em 17/11 → paga na segunda 24/11
create or replace function public.gd_payout_date(paid timestamptz, hold_days integer default 7)
returns date language sql immutable as $$
  select d + (8 - extract(isodow from d)::int)
  from (select ((paid + make_interval(days => hold_days)) at time zone 'America/Sao_Paulo')::date as d) x
$$;

-- Marca o pedido como pago (uma vez só) e cria a comissão de quem indicou
create or replace function public.gd_mark_paid(p_order text, p_email text, p_payment text, p_percent integer default 50, p_hold_days integer default 7)
returns boolean language plpgsql as $$
declare
  o public.orders;
  r public.referrers;
begin
  update public.orders
     set status = 'PAID', paid_at = now(), email = coalesce(p_email, email), mp_payment = coalesce(p_payment, mp_payment)
   where id = p_order and status = 'PENDING'
  returning * into o;
  if not found then return false; end if;

  if o.ref is not null then
    select * into r from public.referrers where slug = o.ref;
    if found then
      insert into public.commissions (order_id, slug, amount, status, payout_on)
      values (
        o.id, r.slug, (o.amount * p_percent) / 100,
        case when p_email is not null and lower(p_email) = lower(r.email) then 'VOID' else 'HOLD' end,
        public.gd_payout_date(o.paid_at, p_hold_days)
      )
      on conflict (order_id) do nothing;
    end if;
  end if;
  return true;
end $$;

-- Reembolso ou contestação: cancela o pedido e a comissão que ainda não foi paga
create or replace function public.gd_mark_refunded(p_order text)
returns void language sql as $$
  update public.orders set status = 'REFUNDED' where id = p_order and status <> 'REFUNDED';
  update public.commissions set status = 'VOID' where order_id = p_order and status = 'HOLD';
$$;

create or replace function public.gd_click(p_slug text)
returns void language sql as $$
  update public.referrers set clicks = clicks + 1 where slug = p_slug;
$$;

create or replace function public.gd_download(p_order text)
returns void language sql as $$
  update public.orders set downloads = downloads + 1 where id = p_order;
$$;

-- O que precisa ser pago até a data informada, um total por indicador
create or replace view public.gd_due as
  select r.slug, r.name, r.email, r.pix_type, r.pix_key,
         sum(c.amount)::int as amount, count(*)::int as sales,
         min(c.payout_on) as since,
         array_agg(c.order_id order by c.created_at) as orders
    from public.commissions c join public.referrers r on r.slug = c.slug
   where c.status = 'HOLD' and c.payout_on <= (now() at time zone 'America/Sao_Paulo')::date
   group by r.slug;

-- Registra o PIX enviado para um indicador: tudo o que estava vencido vira pago, num passo só
create or replace function public.gd_pay(p_slug text, p_note text default null)
returns public.payouts language plpgsql as $$
declare
  r public.referrers;
  p public.payouts;
  total integer;
begin
  select * into r from public.referrers where slug = p_slug for update;
  if not found then raise exception 'indicador não encontrado'; end if;

  select coalesce(sum(amount), 0) into total from public.commissions
   where slug = p_slug and status = 'HOLD' and payout_on <= (now() at time zone 'America/Sao_Paulo')::date;
  if total = 0 then raise exception 'nada a pagar'; end if;

  insert into public.payouts (slug, amount, pix_key, pix_type, note)
  values (p_slug, total, r.pix_key, r.pix_type, p_note) returning * into p;

  update public.commissions set status = 'PAID', payout_id = p.id
   where slug = p_slug and status = 'HOLD' and payout_on <= (now() at time zone 'America/Sao_Paulo')::date;
  return p;
end $$;

create or replace function public.gd_stats()
returns json language sql stable as $$
  select json_build_object(
    'paid',     (select count(*) from public.orders where status = 'PAID'),
    'revenue',  (select coalesce(sum(amount), 0) from public.orders where status = 'PAID'),
    'referred', (select count(*) from public.orders where status = 'PAID' and ref is not null),
    'refunded', (select count(*) from public.orders where status = 'REFUNDED'),
    'owed',     (select coalesce(sum(amount), 0) from public.commissions where status = 'HOLD'),
    'paidOut',  (select coalesce(sum(amount), 0) from public.commissions where status = 'PAID')
  )
$$;

-- só o servidor chama as funções
revoke all on function public.gd_payout_date(timestamptz, integer), public.gd_mark_paid(text, text, text, integer, integer),
  public.gd_mark_refunded(text), public.gd_click(text), public.gd_download(text), public.gd_pay(text, text), public.gd_stats()
  from public, anon, authenticated;
revoke all on public.gd_due from anon, authenticated;

-- bucket privado para o executável
insert into storage.buckets (id, name, public) values ('releases', 'releases', false)
on conflict (id) do nothing;
