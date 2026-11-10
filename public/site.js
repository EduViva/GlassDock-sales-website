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

  // compra: cria o pedido e vai para o pagamento do AbacatePay
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-buy]');
    if (!b) return;
    e.preventDefault();
    if (b.disabled) return;
    const label = b.innerHTML;
    b.disabled = true;
    b.innerHTML = '<span class="spin"></span> Abrindo pagamento';
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: document.body.dataset.ref || null }),
      });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error || 'Falhou');
      location.href = d.url;
    } catch (err) {
      toast(err.message && err.message !== 'Failed to fetch' ? err.message : 'Sem conexão com o servidor. Tente de novo', 3600);
      b.disabled = false;
      b.innerHTML = label;
    }
  });

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
