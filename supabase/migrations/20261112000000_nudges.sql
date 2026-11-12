-- E-mails de indicação no 3º e no 12º dia depois da compra
alter table public.orders add column if not exists nudge3_at    timestamptz;
alter table public.orders add column if not exists nudge12_at   timestamptz;
alter table public.orders add column if not exists no_marketing boolean not null default false;

-- Pedidos pagos (não reembolsados) que chegaram ao dia p_day, contando no horário de Brasília.
-- Se a rotina falhar num dia, pega até 5 dias depois; nunca manda duas vezes.
create or replace function public.gd_nudge_due(p_day integer)
returns table (id text, email text, paid_at timestamptz) language sql stable as $$
  select o.id, o.email, o.paid_at from public.orders o
   where o.status = 'PAID' and o.email is not null and not o.no_marketing
     and (o.paid_at at time zone 'America/Sao_Paulo')::date <= (now() at time zone 'America/Sao_Paulo')::date - p_day
     and (o.paid_at at time zone 'America/Sao_Paulo')::date >  (now() at time zone 'America/Sao_Paulo')::date - p_day - 5
     and case when p_day = 3 then o.nudge3_at is null else o.nudge12_at is null end
     and not exists (select 1 from public.orders x where lower(x.email) = lower(o.email) and x.no_marketing)
   order by o.paid_at
   limit 200
$$;

-- "Não quero mais esses e-mails": vale para todas as compras do mesmo e-mail
create or replace function public.gd_unsubscribe(p_order text)
returns boolean language sql as $$
  with o as (select email from public.orders where id = p_order)
  update public.orders set no_marketing = true where lower(email) = lower((select email from o)) returning true
$$;

revoke all on function public.gd_nudge_due(integer), public.gd_unsubscribe(text) from public, anon, authenticated;
