// Dock de demonstração: mesmo visual do GlassDock (vidro, tiles dos widgets, ampliação estilo Mac)
(function () {
  const svg = (inner, bg) =>
    `<svg viewBox="0 0 100 100" aria-hidden="true">${bg || ''}${inner}</svg>`;
  const lg = (id, a, b, dir) =>
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="${dir === 'h' ? 1 : 0.4}" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100" height="100" fill="url(#${id})"/>`;
  let uid = 0;
  const g = (a, b) => lg('g' + ++uid, a, b);
  const W = 'fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"';

  // ícones genéricos (sem marcas)
  const ICONS = {
    files: () => svg(`<path d="M22 34a6 6 0 0 1 6-6h14l7 7h23a6 6 0 0 1 6 6v25a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6z" fill="#fff" fill-opacity=".95"/><path d="M22 44h56" stroke="#0a6fe0" stroke-opacity=".25" stroke-width="3"/>`, g('#7cc7ff', '#0A84FF')),
    web: () => svg(`<circle cx="50" cy="50" r="27" ${W}/><path d="M23 50h54M50 23c-10 9-10 45 0 54M50 23c10 9 10 45 0 54" ${W} stroke-width="5"/>`, g('#40C8E0', '#2f6bff')),
    mail: () => svg(`<rect x="22" y="31" width="56" height="40" rx="7" fill="#fff"/><path d="M24 35l26 19 26-19" fill="none" stroke="#3a7bff" stroke-width="5" stroke-linejoin="round"/>`, g('#62b6ff', '#3a5bff')),
    music: () => svg(`<path d="M42 66V32l30-6v34" ${W} stroke-width="6.5"/><circle cx="35" cy="66" r="8" fill="#fff"/><circle cx="65" cy="60" r="8" fill="#fff"/>`, g('#ff7a93', '#ff2d55')),
    chat: () => svg(`<path d="M50 24c16.6 0 29 10.5 29 24S66.6 72 50 72c-3.6 0-7-.5-10.2-1.4L27 76l3.6-10.6C25 61 21 55 21 48c0-13.5 12.4-24 29-24z" fill="#fff"/>`, g('#5ee07a', '#1fb84a')),
    photos: () => {
      const c = ['#FF9F0A', '#FFD60A', '#30D158', '#40C8E0', '#0A84FF', '#BF5AF2', '#FF375F', '#FF6B3D'];
      let p = '';
      c.forEach((col, i) => { p += `<ellipse cx="50" cy="33" rx="9.5" ry="16" fill="${col}" fill-opacity=".86" transform="rotate(${i * 45} 50 50)"/>`; });
      return svg(p, '<rect width="100" height="100" fill="#fff"/>');
    },
    code: () => svg(`<path d="M38 34L22 50l16 16M62 34l16 16-16 16" ${W} stroke-width="7"/><path d="M55 28L45 72" ${W} stroke-width="6" stroke-opacity=".7"/>`, g('#a56bff', '#5E3BEE')),
    terminal: () => svg(`<path d="M27 38l13 12-13 12" fill="none" stroke="#30D158" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M48 64h24" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`, g('#3a3a42', '#16161b')),
    notes: () => svg(`<rect x="0" y="0" width="100" height="26" fill="#FFD60A"/><path d="M24 44h52M24 57h52M24 70h34" stroke="#c9c9cf" stroke-width="5" stroke-linecap="round"/>`, '<rect width="100" height="100" fill="#fff"/>'),
    settings: () => svg(`<circle cx="50" cy="50" r="13" fill="none" stroke="#fff" stroke-width="7"/><path d="M50 18v12M50 70v12M18 50h12M70 50h12M27.4 27.4l8.5 8.5M64.1 64.1l8.5 8.5M27.4 72.6l8.5-8.5M64.1 35.9l8.5-8.5" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`, g('#a9a9b2', '#5f5f69')),
    game: () => svg(`<path d="M30 38h40a14 14 0 0 1 13.6 17.3l-3 12A8 8 0 0 1 67 69l-8-8H41l-8 8a8 8 0 0 1-13.6-3.7l-3-12A14 14 0 0 1 30 38z" fill="#fff"/><path d="M33 47v10M28 52h10" stroke="#ff8a00" stroke-width="4.5" stroke-linecap="round"/><circle cx="64" cy="49" r="3.6" fill="#ff8a00"/><circle cx="70" cy="56" r="3.6" fill="#ff8a00"/>`, g('#ffb340', '#ff6a00')),
    design: () => svg(`<path d="M62 22l16 16-36 36-20 4 4-20z" fill="#fff"/><path d="M56 28l16 16" stroke="#e0407a" stroke-width="5"/>`, g('#ff8fb1', '#b04bff')),
    // ícones redondos (sem fundo) para mostrar a placa
    orb: () => svg(`<defs><radialGradient id="o${++uid}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffe27a"/><stop offset=".55" stop-color="#ff7a3d"/><stop offset="1" stop-color="#d1265a"/></radialGradient></defs><circle cx="50" cy="50" r="40" fill="url(#o${uid})"/><path d="M30 56c10-4 26-4 40 0" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="50" cy="40" r="9" fill="#fff" fill-opacity=".85"/>`),
    bubble: () => svg(`<circle cx="50" cy="50" r="40" fill="#5E3BEE"/><circle cx="50" cy="50" r="40" fill="url(#b${++uid})"/><defs><linearGradient id="b${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6bff"/><stop offset="1" stop-color="#4a2bd6"/></linearGradient></defs><circle cx="36" cy="50" r="5.5" fill="#fff"/><circle cx="50" cy="50" r="5.5" fill="#fff"/><circle cx="64" cy="50" r="5.5" fill="#fff"/>`),
    // apps da dock do topo (sobre a placa branca)
    chrome: () => svg(`<path d="M50 50 L15.4 30 A40 40 0 0 1 84.6 30 Z" fill="#EA4335"/><path d="M50 50 L84.6 30 A40 40 0 0 1 50 90 Z" fill="#FBBC05"/><path d="M50 50 L50 90 A40 40 0 0 1 15.4 30 Z" fill="#34A853"/><circle cx="50" cy="50" r="18.5" fill="#fff"/><circle cx="50" cy="50" r="14.5" fill="#4285F4"/>`),
    figma: () => svg(`<rect x="17" y="17" width="66" height="66" rx="15" fill="#1e1e1e"/><g transform="translate(0 6)"><path d="M38 32a6 6 0 0 1 6-6h6v12h-6a6 6 0 0 1-6-6z" fill="#F24E1E"/><path d="M50 26h6a6 6 0 0 1 0 12h-6z" fill="#FF7262"/><path d="M38 44a6 6 0 0 1 6-6h6v12h-6a6 6 0 0 1-6-6z" fill="#A259FF"/><circle cx="56" cy="44" r="6" fill="#1ABCFE"/><path d="M38 56a6 6 0 0 1 6-6h6v6a6 6 0 0 1-12 0z" fill="#0ACF83"/></g>`),
    teams: () => svg(`<circle cx="67" cy="31" r="8.5" fill="#7B83EB"/><rect x="55" y="42" width="27" height="30" rx="9" fill="#7B83EB"/><circle cx="48" cy="27" r="11" fill="#5059C9"/><rect x="32" y="41" width="36" height="38" rx="10" fill="#5B5FC7"/><rect x="17" y="40" width="31" height="31" rx="6" fill="#4B53BC"/><path d="M24.5 48h16v4.6h-5.6V65h-4.8V52.6h-5.6z" fill="#fff"/>`),
    start: () => svg(`<rect x="27" y="27" width="20" height="20" rx="4" fill="#fff"/><rect x="53" y="27" width="20" height="20" rx="4" fill="#fff"/><rect x="27" y="53" width="20" height="20" rx="4" fill="#fff"/><rect x="53" y="53" width="20" height="20" rx="4" fill="#fff"/>`, g('#4aa8ff', '#0a6fe0')),
    trash: () => svg(`<path d="M30 34h40l-4 40H34z" fill="#fff" fill-opacity=".92"/><path d="M26 32h48M42 26h16" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M44 44v22M56 44v22" stroke="#9aa0ad" stroke-width="3.5" stroke-linecap="round"/>`, g('#c7cbd4', '#7d828f')),
    downloads: () => svg(`<path d="M50 26v34M36 47l14 14 14-14" ${W} stroke-width="7"/><path d="M28 70h44" ${W} stroke-width="7"/>`, g('#69d0ff', '#2f7bff')),
  };

  const STATUS = {
    wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2.5 9a14 14 0 0 1 19 0M5.8 12.5a9 9 0 0 1 12.4 0M9.2 16a4 4 0 0 1 5.6 0"/><circle cx="12" cy="19.2" r="1.2" fill="currentColor" stroke="none"/></svg>',
    vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
    bat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2.5" y="7" width="17" height="10" rx="2.6"/><rect x="4.6" y="9.1" width="10.6" height="5.8" rx="1.2" fill="currentColor" stroke="none"/><path d="M21.6 10.4v3.2" stroke-linecap="round" stroke-width="2"/></svg>',
  };

  const CAT = `<svg viewBox="0 0 46 34"><ellipse cx="23" cy="32" rx="15" ry="2" fill="#000" fill-opacity=".25"/><path d="M8 18c-5-2-7-8-5-12" stroke="#f0a35e" stroke-width="3.2" fill="none" stroke-linecap="round"/><rect x="8" y="14" width="22" height="13" rx="6.5" fill="#f4ac63"/><rect x="11" y="23" width="4" height="8" rx="2" fill="#f4ac63"/><rect x="23" y="23" width="4" height="8" rx="2" fill="#f4ac63"/><ellipse cx="18" cy="22" rx="6" ry="3.4" fill="#fff4e6"/><circle cx="33" cy="13" r="8.5" fill="#f4ac63"/><path d="M26.5 8.5l1-7 5 5zM39.5 8.5l-1-7-5 5z" fill="#f4ac63"/><circle cx="35.6" cy="12.2" r="1.3" fill="#2b2b2b"/><circle cx="30.4" cy="12.2" r="1.3" fill="#2b2b2b"/><path d="M32 15.6l1 .8 1-.8" stroke="#a0522d" stroke-width=".9" fill="none"/></svg>`;

  const pad = (n) => String(n).padStart(2, '0');
  const WD = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  function tileHTML(t) {
    const now = new Date();
    switch (t.w) {
      case 'music':
        return `<div class="tile" style="--u:3"><div style="position:absolute;inset:0;display:flex;align-items:center;gap:calc(var(--s)*.16);padding:0 calc(var(--s)*.14)">
          <div style="width:calc(var(--s)*.72);height:calc(var(--s)*.72);border-radius:calc(var(--s)*.14);background:linear-gradient(135deg,#ff5f8f,#a33bff);flex:none;display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.3)">${ICONS.music().replace('<svg', '<svg style="width:70%;height:70%"').replace(/<defs>.*?<\/defs><rect[^>]*\/>/, '')}</div>
          <div style="min-width:0;flex:1;line-height:1.2"><div style="font-size:calc(var(--s)*.22);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Noite de neon</div><div style="font-size:calc(var(--s)*.19);opacity:.6;white-space:nowrap">Lua Azul</div></div>
          <div style="display:flex;gap:calc(var(--s)*.12);align-items:center;flex:none">
            <svg viewBox="0 0 24 24" style="width:calc(var(--s)*.2)" fill="#fff" opacity=".8"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>
            <svg viewBox="0 0 24 24" style="width:calc(var(--s)*.28)" fill="#fff"><path d="M7 4h4v16H7zM13 4h4v16h-4z"/></svg>
            <svg viewBox="0 0 24 24" style="width:calc(var(--s)*.2)" fill="#fff" opacity=".8"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg></div></div></div>`;
      case 'date':
        return `<div class="tile paper" style="--u:1;display:grid;place-items:center;align-content:center;line-height:1"><div style="font-size:calc(var(--s)*.16);font-weight:700;color:#FF453A;letter-spacing:.04em">${WD[now.getDay()]}</div><div style="font-size:calc(var(--s)*.46);font-weight:500;font-family:var(--display);margin-top:2px" data-day>${now.getDate()}</div></div>`;
      case 'weather':
        return `<div class="tile blue" style="--u:1;display:grid;place-items:center;align-content:center;gap:2px"><svg viewBox="0 0 40 30" style="width:calc(var(--s)*.5)"><circle cx="15" cy="12" r="7" fill="#FFD60A"/><path d="M14 26a7 7 0 0 1 1-14 9 9 0 0 1 17 3 5.5 5.5 0 0 1-.5 11z" fill="#fff"/></svg><div style="font-size:calc(var(--s)*.24);font-weight:600">24°</div></div>`;
      case 'activity':
        return `<div class="tile" style="--u:1;padding:calc(var(--s)*.14);display:grid;align-content:center;gap:calc(var(--s)*.1);font-size:calc(var(--s)*.15)" data-activity>
          <div><div style="display:flex;justify-content:space-between;opacity:.85"><span>CPU</span><span class="mono" data-cpu>4%</span></div><div style="height:calc(var(--s)*.07);border-radius:9px;background:rgba(255,255,255,.14);margin-top:2px"><i data-cpub style="display:block;height:100%;width:8%;border-radius:9px;background:#30D158;transition:width .8s"></i></div></div>
          <div><div style="display:flex;justify-content:space-between;opacity:.85"><span>MEM</span><span class="mono" data-mem>41%</span></div><div style="height:calc(var(--s)*.07);border-radius:9px;background:rgba(255,255,255,.14);margin-top:2px"><i data-memb style="display:block;height:100%;width:41%;border-radius:9px;background:#0A84FF;transition:width .8s"></i></div></div></div>`;
      case 'pomodoro':
        return `<div class="tile" style="--u:1;display:grid;place-items:center"><svg viewBox="0 0 40 40" style="width:78%;height:78%"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3.4"/><circle cx="20" cy="20" r="16" fill="none" stroke="#FF453A" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="100.5" stroke-dashoffset="34" transform="rotate(-90 20 20)"/><text x="20" y="23.6" text-anchor="middle" fill="#fff" font-size="10" font-weight="600" font-family="Segoe UI, sans-serif">16:40</text></svg></div>`;
    }
    return '';
  }

  function build(el, cfg) {
    const items = cfg.items;
    let html = '';
    for (const it of items) {
      const opt = it.opt ? ' data-opt' : '';
      if (it.t === 'ws') html += `<div class="d-item d-ws"${opt}><i class="on"></i><i></i><i></i></div>`;
      else if (it.t === 'sep') html += `<div class="d-sep"${opt}></div>`;
      else if (it.t === 'app') html += `<div class="d-item d-app${it.round ? ' round' : ''}"${opt} data-name="${it.name}"${it.panel ? ` data-panel="${it.panel}"` : ''}><div class="ic">${ICONS[it.icon]()}</div>${it.open ? '<span class="dot"></span>' : ''}<span class="tip">${it.name}</span></div>`;
      else if (it.t === 'raw') html += `<div class="d-item ${it.cls || ''}"${opt}${it.panel ? ` data-panel="${it.panel}"` : ''}>${it.html}</div>`;
      else if (it.t === 'w') html += `<div class="d-item"${opt}>${tileHTML(it)}</div>`;
      else if (it.t === 'status') html += `<div class="d-item d-status"${opt}>${STATUS.wifi}${STATUS.vol}${STATUS.bat}</div>`;
      else if (it.t === 'clock') html += `<div class="d-item d-clock"${opt}><span data-time></span><small data-date></small></div>`;
    }
    if (cfg.pet) html += `<div class="d-pet">${CAT}</div>`;
    el.innerHTML = html;
    el.classList.add('dock');
    wire(el);
    tickClock(el);
    return el;
  }

  function tickClock(el) {
    const n = new Date();
    el.querySelectorAll('[data-time]').forEach((x) => (x.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}`));
    el.querySelectorAll('[data-date]').forEach((x) => (x.textContent = `${pad(n.getDate())}/${pad(n.getMonth() + 1)}/${n.getFullYear()}`));
  }

  function wire(el) {
    const apps = () => [...el.querySelectorAll('.d-app')].filter((a) => a.offsetParent);
    const MAX = 1.55;
    let raf = 0, px = null;
    const vertical = () => el.dataset.vertical === '1';

    let centers = [];
    // centros medidos sem ampliação: o ponteiro não "foge" dos ícones enquanto eles crescem
    function measure() {
      el.classList.add('nomotion');
      const list = apps();
      list.forEach((a) => a.style.setProperty('--m', 1));
      centers = list.map((a) => { const r = a.getBoundingClientRect(); return [a, vertical() ? r.top + r.height / 2 : r.left + r.width / 2, r.width]; });
      void el.offsetWidth;
      el.classList.remove('nomotion');
    }
    function apply() {
      raf = 0;
      const mode = el.dataset.mag || 'mac';
      const s = parseFloat(getComputedStyle(el).getPropertyValue('--s')) || 52;
      for (const [a, c, w] of centers) {
        let m = 1;
        if (px !== null && mode !== 'none') {
          const d = Math.abs(px - c);
          if (mode === 'mac') {
            const range = s * 2.6;
            if (d < range) m = 1 + (MAX - 1) * Math.cos((d / range) * (Math.PI / 2));
          } else if (mode === 'scale' && d < w / 2) m = 1.22;
        }
        a.style.setProperty('--m', m.toFixed(3));
      }
    }
    el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') measure(); });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      if (!centers.length) measure();
      px = vertical() ? e.clientY : e.clientX;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    el.addEventListener('pointerleave', () => { px = null; if (!raf) raf = requestAnimationFrame(apply); });

    el.addEventListener('click', (e) => {
      const a = e.target.closest('.d-app');
      if (!a) return;
      const anim = el.dataset.anim || 'bounce';
      a.classList.remove('bounce', 'pulse', 'shake');
      void a.offsetWidth;
      a.classList.add(anim);
      if (!a.querySelector('.dot')) a.insertAdjacentHTML('beforeend', '<span class="dot"></span>');
    });
  }

  // CPU e memória "ao vivo" nos tiles de atividade
  setInterval(() => {
    document.querySelectorAll('[data-activity]').forEach((t) => {
      const cpu = Math.round(3 + Math.random() * 18), mem = Math.round(38 + Math.random() * 6);
      t.querySelector('[data-cpu]').textContent = cpu + '%';
      t.querySelector('[data-mem]').textContent = mem + '%';
      t.querySelector('[data-cpub]').style.width = cpu + '%';
      t.querySelector('[data-memb]').style.width = mem + '%';
    });
    document.querySelectorAll('.dock').forEach(tickClock);
  }, 2000);

  // escolhe o maior ícone (até max) que deixa a dock caber em `box`
  function fit(dock, box, max, min) {
    const run = () => {
      const avail = box.clientWidth * .94 - 40;
      // nem tudo escala junto com o ícone (bolinhas, bordas), então ajusta em alguns passos
      const top = typeof max === 'function' ? max() : max;
      let s = top;
      dock.classList.add('nomotion');
      for (let i = 0; i < 6; i++) {
        dock.style.setProperty('--s', s + 'px');
        const w = dock.scrollWidth;
        if (w <= avail || s <= (min || 24)) break;
        s = Math.max(min || 24, Math.floor(s * avail / w));
      }
      void dock.offsetWidth;
      dock.classList.remove('nomotion');
    };
    run();
    if (document.fonts) document.fonts.ready.then(run);
    if ('ResizeObserver' in window) new ResizeObserver(run).observe(box); else addEventListener('resize', run);
    return run;
  }

  window.GD = { build, fit, ICONS, CAT };
})();
