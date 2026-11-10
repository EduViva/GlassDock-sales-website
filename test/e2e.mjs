// Teste de ponta a ponta do worker contra o Supabase de verdade (pagamento simulado com FAKE_PAY)
// Uso: NODE_USE_ENV_PROXY=1 SUPABASE_SECRET_KEY=... node test/e2e.mjs
import worker from '../src/worker.js';
import assert from 'node:assert/strict';

globalThis.HTMLRewriter ??= class { on() { return this; } transform(r) { return r; } };
const env = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://hzqpfxpvsaezixlxtkab.supabase.co',
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  FAKE_PAY: '1', ADMIN_KEY: 'admin-teste-0123456789', PRICE_CENTS: '890', COMMISSION_PERCENT: '50', HOLD_DAYS: '7',
  ASSETS: { fetch: async () => new Response('<html><body>ok</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }) },
};
const B = 'https://glassdock.test';
const waits = [];
const ctx = { waitUntil: (p) => waits.push(p) };
const call = async (path, init = {}) => {
  const res = await worker.fetch(new Request(B + path, { redirect: 'manual', ...init }), env, ctx);
  await Promise.all(waits.splice(0));
  return res;
};
const post = (path, body, headers = {}) => call(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const tag = 'e2e' + Date.now().toString(36).slice(-5);

// indicador
let r = await post('/api/indicadores', { name: 'Teste ' + tag, email: `${tag}@exemplo.com`, pixType: 'EMAIL', pixKey: `${tag}@exemplo.com`, slug: tag });
const ref = await r.json();
assert.equal(r.status, 200, JSON.stringify(ref));
assert.equal(ref.slug, tag);
console.log('indicador criado', ref.slug);

r = await call('/api/slug?s=' + tag); assert.equal((await r.json()).ok, false);
r = await post('/api/indicadores', { name: 'Outra', email: `${tag}@exemplo.com`, pixType: 'EMAIL', pixKey: 'outra@x.com' }); assert.equal(r.status, 409);
r = await post('/api/indicadores', { name: 'Teste', email: `${tag}@exemplo.com`, pixType: 'EMAIL', pixKey: `${tag}@exemplo.com` }); assert.equal((await r.json()).key, ref.key);
console.log('slug ocupado, e-mail repetido e recuperação ok');

// compra pelo link
r = await post('/api/checkout', {}, { cookie: `gd_ref=${tag}` });
const { url } = await r.json();
const order = new URL(url).searchParams.get('pedido');
r = await call('/api/pedido?pedido=' + order); assert.equal((await r.json()).status, 'PENDING');
r = await call(new URL(url).pathname + new URL(url).search + '&email=comprador@x.com'); assert.equal(r.status, 302);
r = await call('/api/pedido?pedido=' + order); const st = await r.json();
assert.equal(st.status, 'PAID'); assert.equal(st.download, '/baixar/' + order);
console.log('compra paga', order);

// pagar de novo não duplica; compra pelo próprio link não gera comissão
await call(new URL(url).pathname + new URL(url).search);
r = await post('/api/checkout', { ref: tag }); const self = new URL((await r.json()).url);
await call(self.pathname + self.search + `&email=${tag.toUpperCase()}@EXEMPLO.COM`);

r = await call('/api/indicadores/me?k=' + ref.key); const panel = await r.json();
assert.equal(panel.sales, 1, JSON.stringify(panel));
assert.equal(panel.waiting, 445);
assert.equal(panel.recent[0].status, 'agendado');
console.log('painel', { vendas: panel.sales, agendado: panel.waiting, cai: panel.recent[0].payoutOn });

// download (redireciona para o link assinado do Storage, ou 503 se o .exe ainda não subiu)
r = await call('/baixar/' + order); console.log('download', r.status, (r.headers.get('location') || '').replace(/token=[^&]+/, 'token=…'));
r = await call('/baixar/AAAAAAAAAAAAAAAAAAAA'); assert.equal(r.status, 404);

// admin
r = await call('/api/admin?k=errada'); assert.equal(r.status, 401);
r = await call('/api/admin?k=' + env.ADMIN_KEY); const adm = await r.json();
assert.ok(adm.stats.paid >= 1); assert.ok(!adm.due.find((d) => d.slug === tag), 'ainda não deveria estar na fila');
r = await post('/api/admin/paguei?k=' + env.ADMIN_KEY, { slug: tag }); assert.equal(r.status, 400);
console.log('admin ok, fila sem a venda nova, "Paguei" recusado sem nada a pagar');

// webhook sem assinatura válida é recusado quando há segredo
env.MP_WEBHOOK_SECRET = 'segredo';
r = await post('/api/webhook?data.id=123&type=payment', { type: 'payment', data: { id: '123' } }, { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'x' });
assert.equal(r.status, 401);
console.log('webhook com assinatura falsa recusado');

console.log(JSON.stringify({ tag, order }));
