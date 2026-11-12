// Dock do topo: igual à dock real (relógio, agenda, música, apps, Downloads, bandeja e clima),
// com os painéis que abrem no clique e a música tocando de verdade pelo player do YouTube
(function () {
  const desk = document.getElementById('stage');
  const host = document.getElementById('studioDock');
  if (!desk || !host) return;

  const pad = (n) => String(n).padStart(2, '0');
  const WD = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const WDL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const MO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const MOL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  /* ------------------------------------------------------------ agenda de exemplo (relativa a agora) */
  const now0 = new Date();
  const at = (min) => { const d = new Date(now0.getTime() + min * 60000); d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0); return d; };
  const today = [
    { t: 'Café com a Ana', s: at(-150), m: 30, c: '#FF9F0A', w: 'Padaria da esquina' },
    { t: 'Daily do time', s: at(19), m: 15, c: '#FF453A', w: 'Meet' },
    { t: 'Revisão do design', s: at(200), m: 60, c: '#BF5AF2', w: 'Figma' },
  ];
  const tomorrow = [
    { t: 'Entrega do projeto', s: new Date(now0.getFullYear(), now0.getMonth(), now0.getDate() + 1, 10, 0), m: 60, c: '#30D158', w: 'Teams' },
    { t: 'Academia', s: new Date(now0.getFullYear(), now0.getMonth(), now0.getDate() + 1, 18, 30), m: 60, c: '#0A84FF', w: '' },
  ];
  const nextEv = () => today.find((e) => e.s > new Date()) || tomorrow[0];
  const rel = (d) => {
    const min = Math.round((d - new Date()) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `em ${min} min`;
    if (min < 12 * 60) return `em ${Math.floor(min / 60)} h ${min % 60 ? pad(min % 60) : ''}`.trim();
    return hm(d);
  };

  /* ------------------------------------------------------------ tiles */
  const ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2.4v14H6zM19 5v14L9 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 5H18v14h-2.4zM5 5v14l10-7z"/></svg>',
    sun: '<svg viewBox="0 0 40 40"><g stroke="#FFD60A" stroke-width="2.6" stroke-linecap="round"><path d="M20 3v4M20 33v4M3 20h4M33 20h4M8 8l2.8 2.8M29.2 29.2L32 32M8 32l2.8-2.8M29.2 10.8L32 8"/></g><circle cx="20" cy="20" r="8" fill="#FFD60A"/></svg>',
    cloudsun: '<svg viewBox="0 0 40 30"><circle cx="15" cy="12" r="7" fill="#FFD60A"/><path d="M14 26a7 7 0 0 1 1-14 9 9 0 0 1 17 3 5.5 5.5 0 0 1-.5 11z" fill="#fff"/></svg>',
    cloud: '<svg viewBox="0 0 40 30"><path d="M11 26a8 8 0 0 1 1-16 10 10 0 0 1 19 3 6.5 6.5 0 0 1-.5 13z" fill="#dfe6f0"/></svg>',
    rain: '<svg viewBox="0 0 40 34"><path d="M11 22a8 8 0 0 1 1-16 10 10 0 0 1 19 3 6.5 6.5 0 0 1-.5 13z" fill="#cfd8e6"/><path d="M14 26l-2 5M21 26l-2 5M28 26l-2 5" stroke="#5AB8FF" stroke-width="2.4" stroke-linecap="round"/></svg>',
    folder: '<svg viewBox="0 0 40 32"><defs><linearGradient id="fdg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38d3b0"/><stop offset="1" stop-color="#11917c"/></linearGradient></defs><path d="M2 6a3 3 0 0 1 3-3h9l3.4 3.4H35a3 3 0 0 1 3 3V27a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" fill="#0f7a68"/><path d="M2 10.5a3 3 0 0 1 3-3h30a3 3 0 0 1 3 3V27a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" fill="url(#fdg)"/><path d="M20 12v10M15.6 18l4.4 4.4 4.4-4.4M14.5 25.5h11" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
    feather: '<svg viewBox="0 0 24 24"><defs><linearGradient id="fth" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a6ff"/><stop offset="1" stop-color="#7a3df0"/></linearGradient></defs><path d="M20.5 3.5c-6 .4-11 4.2-13 10.2L5 21l1.6.5 2-4.6c6.3-1.2 10.7-6.3 11.9-13.4z" fill="url(#fth)"/><path d="M6.6 20.5L15 9" stroke="#fff" stroke-opacity=".55" stroke-width="1"/></svg>',
  };
  const COVER = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg';
  const VIDEO = 'dQw4w9WgXcQ';

  const items = [
    { t: 'raw', cls: 'hx-clock', panel: 'clock', html: `<div class="tile hx-tile" style="--u:2"><div class="hx-clock-in"><b data-hx="time"></b><small data-hx="date"></small></div></div>` },
    { t: 'raw', cls: 'hx-cal', panel: 'calendar', opt: true, html: `<div class="tile hx-tile" style="--u:3"><div class="hx-cal-in"><div class="hx-day"><small data-hx="wd"></small><b data-hx="day"></b></div><i class="hx-bar"></i><div class="hx-next"><b data-hx="rel"></b><small data-hx="ev"></small></div></div></div>` },
    { t: 'raw', cls: 'hx-music', panel: 'music', html: `<div class="tile hx-tile" style="--u:3"><div class="hx-music-in"><div class="hx-cover"><img src="${COVER}" alt=""><span class="hx-eq"><i></i><i></i><i></i></span></div><div class="hx-song"><b>Never Gonna Give You Up</b><small>Rick Astley</small></div><button class="hx-play" type="button" aria-label="Tocar">${ICON.play}</button></div></div>` },
    { t: 'app', icon: 'chrome', name: 'Google Chrome', open: true, round: true },
    { t: 'app', icon: 'figma', name: 'Figma', round: true, opt: true },
    { t: 'app', icon: 'teams', name: 'Microsoft Teams', open: true, round: true, opt: true },
    { t: 'raw', cls: 'hx-dl', panel: 'downloads', opt: true, html: `<div class="tile hx-tile hx-sq"><span class="hx-folder">${ICON.folder}</span><span class="hx-badge">3</span></div>` },
    { t: 'sep' },
    { t: 'raw', cls: 'hx-tray', panel: 'tray', opt: true, html: `<div class="hx-tray-in"><span class="hx-chev">${ICON.chevron}</span><span class="hx-fth">${ICON.feather}</span></div>` },
    { t: 'sep', opt: true },
    { t: 'raw', cls: 'hx-weather', panel: 'weather', html: `<div class="tile blue hx-sq hx-w"><span class="hx-sun">${ICON.sun}</span><b>26°</b></div><span class="hx-ws"><i class="on"></i><i></i></span>` },
  ];
  const dock = GD.build(host, { items });
  dock.classList.add('hero-dock');
  Object.assign(dock.dataset, { ind: 'bar', glass: 'blur', theme: 'dark', mag: 'mac', plate: '1' });
  dock.style.setProperty('--plate-c', '#f5f5f7');
  let size = 56;
  const refit = GD.fit(dock, desk, () => size, 22);
  window.GDStudio = { dock, setSize(v) { size = v; refit(); if (open) place(open); }, replace: () => open && place(open) };

  /* ------------------------------------------------------------ atualiza os tiles */
  function tick() {
    const n = new Date();
    const set = (k, v) => dock.querySelectorAll(`[data-hx="${k}"]`).forEach((e) => (e.textContent = v));
    set('time', hm(n));
    set('date', `${WD[n.getDay()]} ${n.getDate()} ${MO[n.getMonth()]}`);
    set('wd', WD[n.getDay()]);
    set('day', n.getDate());
    const e = nextEv();
    set('rel', rel(e.s));
    set('ev', `${e.t} · às ${hm(e.s)}`);
    if (open === 'clock') renderClock();
  }

  /* ------------------------------------------------------------ painéis */
  const panels = {};
  let open = null;
  function panel(name, html, width) {
    const el = document.createElement('div');
    el.className = 'dpanel';
    el.dataset.name = name;
    el.style.width = width + 'px';
    el.innerHTML = html;
    el.addEventListener('click', (e) => e.stopPropagation());
    desk.appendChild(el);
    panels[name] = el;
    return el;
  }

  function place(name) {
    const el = panels[name];
    const item = dock.querySelector(`[data-panel="${name}"]`);
    if (!el || !item) return;
    const d = desk.getBoundingClientRect(), r = item.getBoundingClientRect(), k = dock.getBoundingClientRect();
    const w = Math.min(el.offsetWidth, d.width - 24);
    el.style.maxWidth = d.width - 24 + 'px';
    let left = r.left - d.left + r.width / 2 - w / 2;
    left = Math.max(12, Math.min(left, d.width - w - 12));
    el.style.left = left + 'px';
    if (desk.dataset.pos === 'top') {
      el.style.bottom = 'auto';
      el.style.top = k.bottom - d.top + 14 + 'px';
      el.style.maxHeight = d.bottom - k.bottom - 26 + 'px';
      el.classList.add('below');
    } else {
      el.style.top = 'auto';
      el.style.bottom = d.bottom - k.top + 12 + 'px';
      el.style.maxHeight = k.top - d.top - 24 + 'px';
      el.classList.remove('below');
    }
    el.style.setProperty('--ax', `${r.left - d.left + r.width / 2 - left}px`);
  }

  function show(name) {
    hint.classList.add('gone');
    for (const n in panels) if (n !== name) panels[n].classList.remove('show');
    dock.querySelectorAll('[data-panel]').forEach((x) => x.classList.toggle('active', x.dataset.panel === name));
    if (!name || open === name) {
      open = null;
      dock.querySelectorAll('[data-panel]').forEach((x) => x.classList.remove('active'));
      if (name) panels[name].classList.remove('show');
      return;
    }
    open = name;
    render[name] && render[name]();
    place(name);
    panels[name].classList.add('show');
  }

  dock.addEventListener('click', (e) => {
    const it = e.target.closest('[data-panel]');
    if (!it) return;
    e.stopPropagation();
    show(it.dataset.panel);
  });
  document.addEventListener('click', (e) => { if (open && !e.target.closest('.dpanel')) show(null); });
  addEventListener('resize', () => open && place(open));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) show(null); });

  const hint = document.createElement('div');
  hint.className = 'hx-hint';
  hint.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M5 3l14 8-6 1.5L10 19z"/></svg>Abra os widgets: clique na agenda, na música, no clima…';
  desk.appendChild(hint);

  /* relógio */
  const CITIES = [['Lisboa', 'Europe/Lisbon'], ['Nova York', 'America/New_York'], ['Tóquio', 'Asia/Tokyo']];
  panel('clock', `<div class="hp-clock"><b data-c="t"></b><span data-c="d"></span></div>
    <div class="hp-list" data-c="w"></div>
    <div class="hp-row hp-toggle"><div><b>Alarme</b><small>07:30 · dias úteis</small></div><button type="button" class="tgl on" aria-label="Alarme"></button></div>`, 280);
  function renderClock() {
    const p = panels.clock, n = new Date();
    p.querySelector('[data-c="t"]').textContent = `${hm(n)}:${pad(n.getSeconds())}`;
    p.querySelector('[data-c="d"]').textContent = `${WDL[n.getDay()]}, ${n.getDate()} de ${MOL[n.getMonth()]}`;
    p.querySelector('[data-c="w"]').innerHTML = CITIES.map(([c, tz]) => {
      const t = n.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
      const off = Math.round((new Date(n.toLocaleString('en-US', { timeZone: tz })) - new Date(n.toLocaleString('en-US'))) / 3600e3);
      return `<div class="hp-row"><div><b>${c}</b><small>${off === 0 ? 'mesmo horário' : (off > 0 ? '+' : '') + off + ' h'}</small></div><span class="hp-big">${t}</span></div>`;
    }).join('');
  }
  panels.clock.querySelector('.tgl').addEventListener('click', (e) => e.currentTarget.classList.toggle('on'));

  /* calendário */
  let calMonth = new Date(now0.getFullYear(), now0.getMonth(), 1);
  const evDays = new Set([3, 9, 12, 18, 21, 25].map((x) => x));
  panel('calendar', `<div class="hp-head"><b data-k="title"></b><span><button type="button" data-k="prev" aria-label="Mês anterior">‹</button><button type="button" data-k="next" aria-label="Próximo mês">›</button></span></div>
    <div class="hp-cal" data-k="grid"></div>
    <div class="hp-sec">Hoje</div><div data-k="today"></div>
    <div class="hp-sec">Amanhã</div><div data-k="tomorrow"></div>`, 300);
  function renderCalendar() {
    const p = panels.calendar, y = calMonth.getFullYear(), m = calMonth.getMonth(), n = new Date();
    p.querySelector('[data-k="title"]').textContent = `${MOL[m][0].toUpperCase() + MOL[m].slice(1)} ${y}`;
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    let g = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => `<b>${d}</b>`).join('');
    for (let i = 0; i < first; i++) g += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const isToday = d === n.getDate() && m === n.getMonth() && y === n.getFullYear();
      const dow = (first + d - 1) % 7;
      g += `<span class="${isToday ? 'today' : ''} ${dow === 0 || dow === 6 ? 'dim' : ''} ${evDays.has(d) || isToday ? 'ev' : ''}">${d}</span>`;
    }
    p.querySelector('[data-k="grid"]').innerHTML = g;
    const row = (e) => `<div class="hp-ev${e.s.getTime() + e.m * 60000 < Date.now() ? ' past' : ''}"><i style="background:${e.c}"></i><div><b>${e.t}</b><small>${hm(e.s)} – ${hm(new Date(e.s.getTime() + e.m * 60000))}${e.w ? ' · ' + e.w : ''}</small></div>${e === nextEv() ? `<span class="hp-when">${rel(e.s)}</span>` : ''}</div>`;
    p.querySelector('[data-k="today"]').innerHTML = today.map(row).join('');
    p.querySelector('[data-k="tomorrow"]').innerHTML = tomorrow.map(row).join('');
  }
  panels.calendar.querySelector('[data-k="prev"]').onclick = () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); };
  panels.calendar.querySelector('[data-k="next"]').onclick = () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); };

  /* música */
  panel('music', `<div class="hp-art"><img src="${COVER}" alt=""><div id="ytHost"></div><button type="button" class="hp-bigplay" aria-label="Tocar">${ICON.play}</button></div>
    <div class="hp-song"><b>Never Gonna Give You Up</b><span>Rick Astley</span></div>
    <div class="hp-prog"><div class="hp-bar"><i data-m="bar"></i></div><div class="hp-times"><span data-m="cur">0:00</span><span data-m="dur">3:33</span></div></div>
    <div class="hp-ctrl"><button type="button" data-m="prev" aria-label="Voltar ao início">${ICON.prev}</button><button type="button" class="main" data-m="toggle" aria-label="Tocar">${ICON.play}</button><button type="button" data-m="next" aria-label="Próxima">${ICON.next}</button></div>
    <div class="hp-src">Tocando pelo YouTube</div>`, 280);

  let yt = null, ytReady = false, playing = false, wantPlay = false;
  const fmt = (s) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
  function setPlaying(v) {
    playing = v;
    dock.querySelector('.hx-music').classList.toggle('playing', v);
    dock.querySelector('.hx-play').innerHTML = v ? ICON.pause : ICON.play;
    dock.querySelector('.hx-play').setAttribute('aria-label', v ? 'Pausar' : 'Tocar');
    panels.music.querySelector('[data-m="toggle"]').innerHTML = v ? ICON.pause : ICON.play;
    panels.music.classList.toggle('started', !!yt);
  }
  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    return new Promise((res) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev && prev(); res(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
  }
  async function play() {
    wantPlay = true;
    if (open !== 'music') show('music');
    if (yt && ytReady) { yt.playVideo(); return; }
    if (yt) return;
    panels.music.classList.add('loading');
    await loadYT();
    yt = new YT.Player('ytHost', {
      host: 'https://www.youtube-nocookie.com',
      videoId: VIDEO, width: '100%', height: '100%',
      playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, modestbranding: 1, disablekb: 1 },
      events: {
        onReady: (e) => { ytReady = true; panels.music.classList.remove('loading'); if (wantPlay) e.target.playVideo(); },
        onStateChange: (e) => setPlaying(e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING),
      },
    });
    setPlaying(false);
  }
  function pause() { wantPlay = false; if (yt && ytReady) yt.pauseVideo(); setPlaying(false); }
  const toggle = () => (playing || (wantPlay && !ytReady) ? pause() : play());
  dock.querySelector('.hx-play').addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  panels.music.querySelector('[data-m="toggle"]').onclick = toggle;
  panels.music.querySelector('.hp-bigplay').onclick = play;
  panels.music.querySelector('[data-m="prev"]').onclick = () => { if (yt && ytReady) yt.seekTo(0, true); };
  panels.music.querySelector('[data-m="next"]').onclick = () => { if (yt && ytReady) yt.seekTo(0, true); };
  panels.music.querySelector('.hp-bar').onclick = (e) => {
    if (!(yt && ytReady)) return;
    const r = e.currentTarget.getBoundingClientRect();
    yt.seekTo(((e.clientX - r.left) / r.width) * (yt.getDuration() || 213), true);
  };
  setInterval(() => {
    if (!(yt && ytReady && yt.getCurrentTime)) return;
    const c = yt.getCurrentTime() || 0, d = yt.getDuration() || 213;
    panels.music.querySelector('[data-m="bar"]').style.width = (c / d) * 100 + '%';
    panels.music.querySelector('[data-m="cur"]').textContent = fmt(c);
    panels.music.querySelector('[data-m="dur"]').textContent = fmt(d);
  }, 500);

  /* Downloads */
  const FILES = [
    ['GlassDock.exe', '2,0 MB', 'agora', '#5E3BEE', 'EXE'],
    ['Proposta comercial.pdf', '840 KB', 'há 12 min', '#FF453A', 'PDF'],
    ['ferias-praia.jpg', '3,4 MB', 'há 1 h', '#FF9F0A', 'JPG'],
    ['Planilha de gastos.xlsx', '96 KB', 'ontem', '#30D158', 'XLS'],
    ['Figma-Setup.exe', '118 MB', 'ontem', '#A259FF', 'EXE'],
  ];
  panel('downloads', `<div class="hp-head"><b>Downloads</b><span class="hp-pill">3 novos</span></div>
    <div class="hp-files">${FILES.map(([n, s, t, c, x], i) => `<div class="hp-file${i < 3 ? ' new' : ''}"><span class="hp-fi" style="--c:${c}">${x}</span><div><b>${n}</b><small>${s} · ${t}</small></div></div>`).join('')}</div>
    <button type="button" class="hp-btn">Abrir pasta</button>`, 290);

  /* bandeja */
  const TRAY = [
    ['Nuvem', '<path d="M7 18a5 5 0 0 1 .6-10A6.5 6.5 0 0 1 20 10a4 4 0 0 1-1 8z" fill="#5AB8FF"/>'],
    ['Chat', '<path d="M4 5h16v11H9l-5 4z" fill="#8a7dff"/>'],
    ['Segurança', '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" fill="#30D158"/>'],
    ['Notas', '<path d="M20.5 3.5c-6 .4-11 4.2-13 10.2L5 21l1.6.5 2-4.6c6.3-1.2 10.7-6.3 11.9-13.4z" fill="#b57cff"/>'],
    ['Bluetooth', '<path d="M7 7l10 10-5 4V3l5 4L7 17" fill="none" stroke="#5AB8FF" stroke-width="2" stroke-linejoin="round"/>'],
    ['Teclado', '<rect x="3" y="7" width="18" height="11" rx="2" fill="none" stroke="#ddd" stroke-width="1.8"/><path d="M7 11h.01M11 11h.01M15 11h.01M8 15h8" stroke="#ddd" stroke-width="1.8" stroke-linecap="round"/>'],
  ];
  panel('tray', `<div class="hp-head"><b>Bandeja</b><small class="muted">clique e menu de cada app</small></div>
    <div class="hp-tray">${TRAY.map(([n, d]) => `<button type="button" title="${n}"><svg viewBox="0 0 24 24">${d}</svg></button>`).join('')}</div>
    <div class="hp-row"><div><b>Wi-Fi</b><small>Casa_5G · conectado</small></div><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2.5 9a14 14 0 0 1 19 0M5.8 12.5a9 9 0 0 1 12.4 0M9.2 16a4 4 0 0 1 5.6 0"/><circle cx="12" cy="19.2" r="1.2" fill="currentColor"/></svg></div>
    <div class="hp-row"><div style="flex:1"><b>Volume</b><input type="range" min="0" max="100" value="64" aria-label="Volume" class="hp-range"></div></div>
    <div class="hp-row"><div><b>Bateria</b><small>82% · 4 h 10 min restantes</small></div><span class="hp-batt"><i style="width:82%"></i></span></div>`, 280);
  panels.tray.querySelector('.hp-range').addEventListener('input', (e) => { if (yt && ytReady) yt.setVolume(+e.target.value); });

  /* clima */
  const FC = [['Hoje', 'sun', 29, 18], ['Sex', 'cloudsun', 27, 17], ['Sáb', 'rain', 22, 16], ['Dom', 'cloud', 24, 15], ['Seg', 'sun', 28, 17]];
  panel('weather', `<div class="hp-wnow"><div><small>São Paulo</small><b>26°</b><span>Ensolarado · máx 29° mín 18°</span></div><span class="hp-wicon">${ICON.sun}</span></div>
    <div class="hp-wdet"><div><small>Sensação</small><b>27°</b></div><div><small>Umidade</small><b>54%</b></div><div><small>Vento</small><b>12 km/h</b></div><div><small>UV</small><b>7</b></div></div>
    <div class="hp-fc">${FC.map(([d, i, mx, mn]) => `<div><small>${d}</small><span>${ICON[i]}</span><b>${mx}°</b><small>${mn}°</small></div>`).join('')}</div>`, 300);

  const render = { clock: renderClock, calendar: renderCalendar };

  tick();
  setInterval(tick, 1000);

  // a agenda abre sozinha quando a seção aparece, para mostrar que dá para clicar
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      setTimeout(() => { if (!open) { show(innerWidth >= 900 ? 'calendar' : 'music'); hint.classList.remove('gone'); } }, 500);
    }, { threshold: .6 });
    io.observe(desk);
  }
})();
