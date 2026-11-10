// GlassDock: loja, entrega do download e programa de indicação
// Cloudflare Worker (páginas + API) · Supabase (banco e o .exe) · Mercado Pago (pagamento)

const MP = 'https://api.mercadopago.com';
const REF_COOKIE = 'gd_ref';
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,22})[a-z0-9]$/;
// nomes que nunca viram link de indicação
const RESERVED = new Set([
  'api', 'admin', 'baixar', 'download', 'indique', 'indicar', 'obrigado', 'painel', 'comprar', 'checkout',
  'assets', 'static', 'img', 'css', 'js', 'favicon', 'robots', 'sitemap', 'index', 'termos', 'privacidade',
  'suporte', 'ajuda', 'contato', 'login', 'conta', 'glassdock', 'www', 'app', 'blog', 'loja', 'pix',
]);
const PIX_TYPES = ['CPF', 'CNPJ', 'PHONE', 'EMAIL', 'RANDOM'];

export default {
  async fetch(req, env, ctx) {
    try {
      return await route(req, env, ctx);
    } catch (e) {
      console.error(e);
      return json({ error: 'Algo deu errado do nosso lado. Tente de novo em instantes' }, 500);
    }
  },
};

async function route(req, env, ctx) {
  const url = new URL(req.url);
  const p = url.pathname;
  const m = req.method;
  const db = supabase(env);

  if (p === '/api/checkout' && m === 'POST') return checkout(req, env, db, url);
  if (p === '/api/pedido' && m === 'GET') return orderStatus(env, db, url);
  if (p === '/api/webhook' && m === 'POST') return webhook(req, env, db, url);
  if (p === '/api/slug' && m === 'GET') return slugCheck(db, url);
  if (p === '/api/indicadores' && m === 'POST') return createReferrer(req, db, url);
  if (p === '/api/indicadores/me' && m === 'GET') return referrerPanel(env, db, url);
  if (p === '/api/admin' && m === 'GET') return admin(env, db, url);
  if (p === '/api/admin/paguei' && m === 'POST') return adminPaid(req, env, db, url);
  if (p === '/api/dev/pagar' && env.FAKE_PAY === '1') return devPay(env, db, url);
  if (p.startsWith('/baixar/')) return download(env, db, p.slice(8), ctx);
  if (p.startsWith('/api/')) return json({ error: 'Não encontrado' }, 404);

  const asset = await env.ASSETS.fetch(req);
  if (asset.status !== 404) return asset;

  // glassdock.com.br/fulano → a página de vendas com o nome de quem indicou
  const slug = p.slice(1).toLowerCase();
  if (m === 'GET' && SLUG_RE.test(slug)) {
    const r = await db.one('referrers', `slug=eq.${slug}&select=slug,name`);
    if (r) return referralLanding(req, env, ctx, db, r);
  }
  return Response.redirect(url.origin + '/', 302);
}

/* ------------------------------------------------------------------ indicação na página de vendas */

async function referralLanding(req, env, ctx, db, r) {
  const url = new URL(req.url);
  const page = await env.ASSETS.fetch(new Request(url.origin + '/', req));
  const first = r.name.split(' ')[0];
  const html = new HTMLRewriter()
    .on('body', { element: (el) => { el.setAttribute('data-ref', r.slug); el.setAttribute('data-ref-name', first); } })
    .on('title', { element: (el) => el.setInnerContent(`${first} te indicou o GlassDock`) })
    .on('meta[property="og:title"]', { element: (el) => el.setAttribute('content', `${first} te indicou o GlassDock`) })
    .on('link[rel="canonical"]', { element: (el) => el.setAttribute('href', url.origin + '/') })
    .transform(page);

  const res = new Response(html.body, html);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.append('Set-Cookie', `${REF_COOKIE}=${r.slug}; Path=/; Max-Age=${60 * 86400}; SameSite=Lax; Secure`);
  if (getCookie(req, REF_COOKIE) !== r.slug) ctx.waitUntil(db.rpc('gd_click', { p_slug: r.slug }));
  return res;
}

/* ------------------------------------------------------------------ compra */

async function checkout(req, env, db, url) {
  const body = await req.json().catch(() => ({}));
  let ref = String(body.ref || getCookie(req, REF_COOKIE) || '').toLowerCase();
  if (ref && (!SLUG_RE.test(ref) || !(await db.one('referrers', `slug=eq.${ref}&select=slug`)))) ref = '';

  const id = token(20);
  const amount = int(env.PRICE_CENTS, 890);
  await db.insert('orders', { id, ref: ref || null, amount });

  if (env.FAKE_PAY === '1') return json({ url: `${url.origin}/api/dev/pagar?pedido=${id}` });

  const done = `${url.origin}/obrigado?pedido=${id}`;
  const pref = {
    items: [{
      id: 'glassdock', title: 'GlassDock para Windows', description: 'Dock com widgets para Windows 10 e 11',
      quantity: 1, currency_id: 'BRL', unit_price: amount / 100,
    }],
    external_reference: id,
    back_urls: { success: done, pending: done, failure: `${url.origin}/?pagamento=cancelado` },
    auto_return: 'approved',
    statement_descriptor: 'GLASSDOCK',
    payment_methods: { installments: 1, excluded_payment_types: [{ id: 'ticket' }] },
    metadata: { pedido: id, indicador: ref || null },
  };
  // o Mercado Pago só aceita avisos para endereços públicos em https
  if (url.protocol === 'https:') pref.notification_url = `${url.origin}/api/webhook`;

  const res = await mp(env, '/checkout/preferences', pref);
  if (!res.ok) {
    console.error('checkout', res.status, JSON.stringify(res.data));
    return json({ error: 'Não deu para abrir o pagamento agora. Tente de novo em instantes' }, 502);
  }
  await db.update('orders', `id=eq.${id}`, { mp_preference: res.data.id });
  return json({ url: res.data.init_point });
}

async function orderStatus(env, db, url) {
  const id = url.searchParams.get('pedido') || '';
  if (!/^[A-Za-z0-9]{20}$/.test(id)) return json({ error: 'Pedido não encontrado' }, 404);
  let o = await db.one('orders', `id=eq.${id}&select=id,status`);
  if (!o) return json({ error: 'Pedido não encontrado' }, 404);

  // Se o aviso do Mercado Pago ainda não chegou, pergunta direto para ele
  if (o.status === 'PENDING' && env.MP_ACCESS_TOKEN) {
    const res = await mp(env, `/v1/payments/search?external_reference=${id}&sort=date_created&criteria=desc`);
    const pay = res.ok && (res.data.results || []).find((x) => x.status === 'approved');
    if (pay) {
      await applyPayment(env, db, pay);
      o = await db.one('orders', `id=eq.${id}&select=id,status`);
    }
  }
  return json({ status: o.status, download: o.status === 'PAID' ? `/baixar/${o.id}` : null });
}

// Aplica o estado de um pagamento do Mercado Pago (sempre lido da API, nunca do corpo do aviso)
async function applyPayment(env, db, pay) {
  const order = pay.external_reference;
  if (!order) return;
  if (pay.status === 'approved') {
    await db.rpc('gd_mark_paid', {
      p_order: order,
      p_email: pay.payer?.email || null,
      p_payment: String(pay.id),
      p_percent: int(env.COMMISSION_PERCENT, 50),
      p_hold_days: int(env.HOLD_DAYS, 7),
    });
  } else if (pay.status === 'refunded' || pay.status === 'charged_back') {
    await db.rpc('gd_mark_refunded', { p_order: order });
  }
}

async function webhook(req, env, db, url) {
  const raw = await req.text();
  let body = {};
  try { body = JSON.parse(raw || '{}'); } catch {}
  const type = body.type || url.searchParams.get('type') || url.searchParams.get('topic');
  const dataId = url.searchParams.get('data.id') || body.data?.id || url.searchParams.get('id');
  if (type !== 'payment' || !dataId) return json({ ok: true, ignored: type || 'sem tipo' });

  if (env.MP_WEBHOOK_SECRET && !(await verifyMpSignature(req, env.MP_WEBHOOK_SECRET, String(dataId)))) {
    return json({ error: 'Invalid signature' }, 401);
  }
  const res = await mp(env, `/v1/payments/${encodeURIComponent(dataId)}`);
  // pagamento inexistente (ex.: o botão Simular do painel do Mercado Pago): nada a fazer
  if (res.status === 404) return json({ ok: true, ignored: 'pagamento não encontrado' });
  if (!res.ok) return json({ error: 'payment lookup failed' }, 502); // o Mercado Pago tenta de novo
  await applyPayment(env, db, res.data);
  return json({ ok: true });
}

// x-signature: "ts=...,v1=..." · manifesto "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" assinado com HMAC-SHA256
async function verifyMpSignature(req, secret, dataId) {
  const sig = req.headers.get('x-signature') || '';
  const reqId = req.headers.get('x-request-id') || '';
  const parts = Object.fromEntries(sig.split(',').map((s) => s.trim().split('=')).filter((x) => x.length === 2));
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifest = `id:${id};`;
  if (reqId) manifest += `request-id:${reqId};`;
  manifest += `ts:${parts.ts};`;
  const expected = await hmacHex(secret, manifest);
  return safeEqual(expected, parts.v1);
}

async function download(env, db, id, ctx) {
  if (!/^[A-Za-z0-9]{20}$/.test(id)) return new Response('Link de download inválido', { status: 404 });
  const o = await db.one('orders', `id=eq.${id}&select=id,status`);
  if (!o || o.status !== 'PAID') return new Response('Link de download inválido', { status: 404 });

  const key = env.EXE_KEY || 'GlassDock.exe';
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/releases/${key}`, {
    method: 'POST',
    headers: { ...sbHeaders(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 300 }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.signedURL) return new Response('O arquivo ainda não foi enviado para o servidor', { status: 503 });
  ctx.waitUntil(db.rpc('gd_download', { p_order: id }));
  return Response.redirect(`${env.SUPABASE_URL}/storage/v1${d.signedURL}&download=GlassDock.exe`, 302);
}

// Só existe com FAKE_PAY=1 (desenvolvimento): simula o pagamento sem passar pelo Mercado Pago
async function devPay(env, db, url) {
  const id = url.searchParams.get('pedido') || '';
  await applyPayment(env, db, { status: 'approved', external_reference: id, id: 'dev', payer: { email: url.searchParams.get('email') } });
  return Response.redirect(`${url.origin}/obrigado?pedido=${id}`, 302);
}

/* ------------------------------------------------------------------ indicadores */

async function slugCheck(db, url) {
  const s = (url.searchParams.get('s') || '').toLowerCase();
  if (!SLUG_RE.test(s)) return json({ ok: false, reason: 'Use de 3 a 24 letras, números ou hífen' });
  if (RESERVED.has(s) || (await db.one('referrers', `slug=eq.${s}&select=slug`))) {
    return json({ ok: false, reason: 'Esse já está em uso', suggestion: await freeSlug(db, s) });
  }
  return json({ ok: true });
}

async function freeSlug(db, base) {
  base = base.slice(0, 20).replace(/-+$/, '');
  if (base.length < 3) base = (base + 'dock').slice(0, 6);
  const { data } = await db.select('referrers', `slug=like.${base}*&select=slug`);
  const taken = new Set((data || []).map((r) => r.slug));
  if (!RESERVED.has(base) && !taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
  return `${base}${token(4).toLowerCase()}`;
}

async function createReferrer(req, db, url) {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 120);
  const pixType = String(b.pixType || '').toUpperCase();
  let pixKey = String(b.pixKey || '').trim().slice(0, 140);

  if (name.length < 2) return json({ error: 'Conta pra gente o seu nome' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Esse e-mail parece incompleto' }, 400);
  if (!PIX_TYPES.includes(pixType)) return json({ error: 'Escolha o tipo da chave PIX' }, 400);
  pixKey = normalizePix(pixType, pixKey);
  if (!pixKey) return json({ error: 'Confira a sua chave PIX' }, 400);

  // mesmo e-mail + mesma chave = a pessoa voltando para pegar o link de novo
  const existing = await db.one('referrers', `email=eq.${encodeURIComponent(email)}&select=*`);
  if (existing) {
    if (existing.pix_key === pixKey) return json(referrerOut(existing, url));
    return json({ error: 'Esse e-mail já tem um link. Use a mesma chave PIX do cadastro para recuperar' }, 409);
  }

  let slug = String(b.slug || '').toLowerCase().trim();
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) slug = slugify(name);

  for (let attempt = 0; attempt < 3; attempt++) {
    const row = { slug: await freeSlug(db, slug), name, email, pix_key: pixKey, pix_type: pixType, secret: token(24) };
    const res = await db.insert('referrers', row);
    if (res.ok) return json(referrerOut(row, url));
    if (res.status !== 409) throw new Error('insert referrer ' + res.status + ' ' + JSON.stringify(res.data));
  }
  return json({ error: 'Tente de novo em instantes' }, 409);
}

function referrerOut(r, url) {
  return { slug: r.slug, name: r.name, link: `${url.origin}/${r.slug}`, key: r.secret };
}

async function referrerPanel(env, db, url) {
  const k = url.searchParams.get('k') || '';
  if (!/^[A-Za-z0-9]{24}$/.test(k)) return json({ error: 'Painel não encontrado' }, 404);
  const r = await db.one('referrers', `secret=eq.${k}&select=*`);
  if (!r) return json({ error: 'Painel não encontrado' }, 404);
  const { data } = await db.select('commissions', `slug=eq.${r.slug}&status=neq.VOID&select=amount,status,payout_on,created_at&order=created_at.desc`);
  const today = todayBR();

  let waiting = 0, due = 0, paid = 0, next = null;
  const recent = [];
  for (const c of data || []) {
    if (c.status === 'PAID') paid += c.amount;
    else if (c.payout_on <= today) due += c.amount;
    else { waiting += c.amount; if (!next || c.payout_on < next) next = c.payout_on; }
    if (recent.length < 30) recent.push({ at: c.created_at, amount: c.amount, status: c.status === 'PAID' ? 'pago' : c.payout_on <= today ? 'hoje' : 'agendado', payoutOn: c.payout_on });
  }
  return json({
    name: r.name, slug: r.slug, link: `${url.origin}/${r.slug}`,
    pix: maskPix(r.pix_type, r.pix_key), clicks: r.clicks, sales: (data || []).length,
    waiting, due, paid, next, recent, holdDays: int(env.HOLD_DAYS, 7),
  });
}

/* ------------------------------------------------------------------ admin */

function isAdmin(env, url) {
  const k = url.searchParams.get('k') || '';
  return env.ADMIN_KEY && env.ADMIN_KEY.length >= 16 && k === env.ADMIN_KEY;
}

async function admin(env, db, url) {
  if (!isAdmin(env, url)) return json({ error: 'Unauthorized' }, 401);
  const [stats, due, refs, orders, payouts] = await Promise.all([
    db.rpc('gd_stats', {}),
    db.select('gd_due', 'select=*&order=amount.desc'),
    db.select('referrers', 'select=slug,name,email,clicks,created_at&order=created_at.desc&limit=200'),
    db.select('orders', 'select=id,ref,status,amount,email,created_at,paid_at,downloads&order=created_at.desc&limit=100'),
    db.select('payouts', 'select=*&order=created_at.desc&limit=50'),
  ]);

  // antes de pagar, confere no Mercado Pago se nenhuma dessas vendas foi devolvida
  let dueRows = due.data || [];
  if (env.MP_ACCESS_TOKEN && dueRows.length) {
    const ids = dueRows.flatMap((d) => d.orders);
    const { data: os } = await db.select('orders', `id=in.(${ids.join(',')})&select=id,mp_payment`);
    let changed = false;
    for (const o of os || []) {
      if (!o.mp_payment || o.mp_payment === 'dev') continue;
      const res = await mp(env, `/v1/payments/${o.mp_payment}`);
      if (res.ok && res.data.status !== 'approved') { await applyPayment(env, db, res.data); changed = true; }
    }
    if (changed) dueRows = (await db.select('gd_due', 'select=*&order=amount.desc')).data || [];
  }
  return json({ stats: stats.data, due: dueRows, referrers: refs.data, orders: orders.data, payouts: payouts.data });
}

async function adminPaid(req, env, db, url) {
  if (!isAdmin(env, url)) return json({ error: 'Unauthorized' }, 401);
  const b = await req.json().catch(() => ({}));
  if (!SLUG_RE.test(String(b.slug || ''))) return json({ error: 'Indicador inválido' }, 400);
  const res = await db.rpc('gd_pay', { p_slug: b.slug, p_note: b.note ? String(b.note).slice(0, 200) : null });
  if (!res.ok) return json({ error: res.data?.message || 'Falhou' }, 400);
  return json({ payout: res.data });
}

/* ------------------------------------------------------------------ Supabase (REST) */

function sbHeaders(env) {
  const key = env.SUPABASE_SECRET_KEY || '';
  // chaves novas (sb_secret_…) vão só no apikey; a service_role antiga (JWT) vai nos dois
  return key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

function supabase(env) {
  const base = `${env.SUPABASE_URL}/rest/v1`;
  const call = async (method, path, body, prefer) => {
    const res = await fetch(`${base}/${path}`, {
      method,
      headers: { ...sbHeaders(env), 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok && res.status !== 409) console.error('supabase', method, path, res.status, text.slice(0, 300));
    return { ok: res.ok, status: res.status, data };
  };
  return {
    select: (table, q) => call('GET', `${table}?${q}`),
    async one(table, q) {
      const r = await call('GET', `${table}?${q}&limit=1`);
      if (!r.ok) throw new Error(`supabase ${table} ${r.status}`);
      return r.data?.[0] || null;
    },
    async insert(table, row) {
      const r = await call('POST', table, row, 'return=minimal');
      if (!r.ok && r.status !== 409) throw new Error(`supabase insert ${table} ${r.status}`);
      return r;
    },
    async update(table, q, patch) {
      const r = await call('PATCH', `${table}?${q}`, patch, 'return=minimal');
      if (!r.ok) throw new Error(`supabase update ${table} ${r.status}`);
      return r;
    },
    rpc: (fn, args) => call('POST', `rpc/${fn}`, args),
  };
}

/* ------------------------------------------------------------------ Mercado Pago */

async function mp(env, path, body) {
  if (!env.MP_ACCESS_TOKEN) return { ok: false, status: 0, data: { message: 'MP_ACCESS_TOKEN não configurado' } };
  const headers = { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };
  if (body) headers['X-Idempotency-Key'] = crypto.randomUUID();
  const res = await fetch(MP + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

/* ------------------------------------------------------------------ util */

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function todayBR() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function normalizePix(type, key) {
  const digits = key.replace(/\D/g, '');
  switch (type) {
    case 'CPF': return digits.length === 11 ? digits : '';
    case 'CNPJ': return digits.length === 14 ? digits : '';
    case 'PHONE': {
      const d = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
      return d.length === 10 || d.length === 11 ? `+55${d}` : '';
    }
    case 'EMAIL': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key) ? key.toLowerCase() : '';
    case 'RANDOM': return /^[0-9a-f-]{32,36}$/i.test(key) ? key.toLowerCase() : '';
  }
  return '';
}

function maskPix(type, key) {
  if (type === 'EMAIL') return key.replace(/^(.).*(@.*)$/, '$1•••$2');
  if (key.length <= 4) return key;
  return '•••' + key.slice(-4);
}

function slugify(name) {
  const parts = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean);
  let s = parts[0] || 'amigo';
  if (s.length < 3 && parts[1]) s += parts[1];
  return s.slice(0, 20);
}

function token(n) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (const x of b) s += abc[x % abc.length];
  return s;
}

function int(v, d) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}

function getCookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
