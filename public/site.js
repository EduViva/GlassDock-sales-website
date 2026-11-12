// Comportamento comum às páginas: animação de entrada, indicação, botão de compra, toast
(function () {
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' })
    : null;
  document.querySelectorAll('.rv').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));

  // nome de quem indicou (injetado pelo servidor no link glassdock.com.br/fulano)
  const refName = document.body.dataset.refName;
  if (refName) {
    document.querySelectorAll('[data-ref-first]').forEach((el) => (el.textContent = refName));
    document.querySelectorAll('[data-ref-initial]').forEach((el) => (el.textContent = refName[0].toUpperCase()));
  }

  window.toast = function (msg, ms) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), ms || 2400);
  };

  window.copyText = async function (text, msg) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    toast(msg || 'Copiado');
  };

  // compra: pede o e-mail, gera o PIX e abre a página de pagamento
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  let modal;
  function openBuy() {
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'buy-modal';
      modal.innerHTML = `
        <form class="buy-card" novalidate>
          <button type="button" class="buy-x" aria-label="Fechar">×</button>
          <img src="/icon.svg" alt="" width="52" height="52">
          <h2>GlassDock por R$ 11,90</h2>
          <p class="muted">Pagamento único por PIX. O download libera assim que o PIX cair</p>
          <label class="field"><span>Seu e-mail</span><input class="input" type="email" name="email" autocomplete="email" required placeholder="voce@email.com"></label>
          <div class="buy-err" role="alert"></div>
          <button class="btn btn-primary btn-lg" type="submit">Gerar PIX</button>
          <p class="buy-fine">Processado pelo Mercado Pago</p>
        </form>`;
      document.body.appendChild(modal);
      const close = () => modal.classList.remove('show');
      modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('.buy-x')) close(); });
      addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      modal.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target, btn = f.querySelector('[type=submit]'), err = f.querySelector('.buy-err');
        const email = f.email.value.trim();
        err.textContent = '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Confira o seu e-mail'; f.email.focus(); return; }
        btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Gerando PIX';
        try {
          const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, ref: document.body.dataset.ref || null }) });
          const d = await r.json();
          if (!r.ok || !d.pedido) throw new Error(d.error || 'Falhou');
          store.set('gd_email', email);
          location.href = '/obrigado?pedido=' + d.pedido;
        } catch (x) {
          err.textContent = x.message && x.message !== 'Failed to fetch' ? x.message : 'Sem conexão com o servidor. Tente de novo';
          btn.disabled = false; btn.textContent = 'Gerar PIX';
        }
      });
    }
    const input = modal.querySelector('[name=email]');
    if (!input.value) input.value = store.get('gd_email') || '';
    modal.classList.add('show');
    setTimeout(() => input.focus(), 50);
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-buy]')) return;
    e.preventDefault();
    openBuy();
  });
  if (/[?&]comprar=1/.test(location.search)) { history.replaceState(null, '', location.pathname); setTimeout(openBuy, 300); }

  // números que contam até o valor quando aparecem
  const counters = document.querySelectorAll('[data-count]');
  const co = 'IntersectionObserver' in window && new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    co.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, t0 = performance.now(), dur = 1100;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
      el.textContent = v;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  counters.forEach((c) => (co ? co.observe(c) : (c.textContent = c.dataset.count)));

  // voltou do Mercado Pago sem pagar
  if (/[?&]pagamento=cancelado/.test(location.search)) {
    setTimeout(() => toast('O pagamento não foi concluído. Pode tentar de novo quando quiser', 4200), 400);
    history.replaceState(null, '', location.pathname + location.hash);
  }

  window.brl = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
})();
