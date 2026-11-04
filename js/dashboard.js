(async () => {
  const finishBoot = () => {
    const boot = document.getElementById('boot');
    if (boot.hidden || boot.classList.contains('out')) return;
    boot.classList.add('out');
    setTimeout(() => { boot.hidden = true; }, 260);
  };
  const c = window.CODEQ_CONFIG;
  const ROOT = document.documentElement.dataset.root || '';
  const HOME = ROOT || './';
  const sb = supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return location.replace(HOME);

  const $ = id => document.getElementById(id);
  const t = k => I18N.t(k);
  const tf = (k, o) => t(k).replace(/\{(\w+)\}/g, (_, x) => o[x] ?? '');
  const lang = () => document.documentElement.lang;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const nf = (n, o) => new Intl.NumberFormat(lang(), o).format(n);
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
    del: k => { try { localStorage.removeItem(k); } catch {} }
  };
  const DEV = { mobile: 'dm', desktop: 'dd', tablet: 'dt' };
  const DEV_ICON = { mobile: 'bx-mobile', desktop: 'bx-desktop', tablet: 'bx-tab' };
  const region = code => { try { return new Intl.DisplayNames([lang()], { type: 'region' }).of(code) || code; } catch { return code; } };
  const srcName = k => k === 'direct' ? t('direct') : k;
  const sysName = k => k === 'Other' ? t('other') : k;

  let user = session.user;
  let sites = [], cur = store.get('site'), days = +store.get('days') || 14;
  let stats = null, statsKey = '', route = 'overview', lastAt = null;
  let metric = store.get('metric') === 'n' ? 'n' : 'v';
  let tabSwitched = false;
  let techTab = store.get('techTab') === 'systems' ? 'systems' : 'browsers';
  const site = () => sites.find(s => s.id === cur);
  const roleOf = s => s?.role || 'owner';
  const isOwner = s => roleOf(s) === 'owner';
  const canManage = s => roleOf(s) !== 'view';
  const isCreator = s => !!s && (!s.role || s.user_id === user.id);
  const ROLES = [['view', 'roleV'], ['manage', 'roleM'], ['owner', 'roleO']];
  const myEmail = () => String(user.email || '').toLowerCase();
  const label = s => (s?.name || s?.title || s?.domain || '').trim();
  const snippet = id => `<script defer src="${new URL(ROOT + 'tracker/a.js', location.href).href}"\n  data-site="${id}"\n  data-api="${c.SUPABASE_URL}/functions/v1/collect"></script>`;

  const meta = () => user.user_metadata || {};
  const myName = () => meta().cq_name || meta().full_name || meta().name || user.email || '';
  const myAvatar = () => { const a = meta().cq_avatar; return a === 'none' ? '' : a || meta().avatar_url || meta().picture || ''; };
  const paintMe = el => {
    const url = myAvatar(), n = myName();
    el.textContent = (n[0] || '?').toUpperCase();
    if (!url || !/^https:\/\//.test(url)) return;
    const img = new Image(); img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.onload = () => { if (el.isConnected) el.replaceChildren(img); };
    img.src = url;
  };
  const personHtml = p => {
    const name = (p?.name || '').trim(), mail = p?.email || '', av = /^https:\/\//.test(p?.avatar || '') ? p.avatar : '';
    return `<span class="person"><span class="me-dot"${av ? ` data-av="${esc(av)}"` : ''}>${esc(((name || mail)[0] || '?').toUpperCase())}</span>` +
      `<span class="person-t"><b>${esc(name || mail)}</b>${name && mail ? `<small>${esc(mail)}</small>` : ''}</span></span>`;
  };
  const paintPeople = box => box.querySelectorAll('[data-av]').forEach(el => {
    const img = new Image(); img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.onload = () => { if (el.isConnected) el.replaceChildren(img); };
    img.src = el.dataset.av; el.removeAttribute('data-av');
  });
  const paintHeader = () => {
    $('who').innerHTML = '<span class="me-dot"></span><span class="me-txt"></span>';
    paintMe($('who').firstChild);
    $('who').lastChild.textContent = myName();
  };
  paintHeader();
  $('who').onclick = () => go('profile');
  const signOut = async () => { await sb.auth.signOut(); location.replace(HOME); };
  $('out').onclick = signOut;

  const paintAva = (el, s) => {
    el.className = 'ava'; el.innerHTML = '<i class="bx bx-globe"></i>';
    if (!s?.icon || !/^https?:\/\//.test(s.icon)) return;
    const img = new Image(); img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.onload = () => { if (el.isConnected && img.naturalWidth > 1) { el.classList.add('has-icon'); el.replaceChildren(img); } };
    img.src = s.icon;
  };
  const askMeta = async id => {
    const { data } = await sb.functions.invoke('site-meta', { body: { site: id } });
    const s = sites.find(x => x.id === id);
    if (s && data?.ok) { s.title = data.title; s.icon = data.icon; s.meta_at = new Date().toISOString(); }
    return !!data?.ok;
  };

  const tween = (el, to, f) => {
    const from = el.dataset.v === undefined ? to : +el.dataset.v;
    el.dataset.v = to;
    if (from === to) { el.textContent = f(to); return; }
    const t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 500); el.textContent = f(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  const delta = (a, b) => {
    if (!b) return '';
    const p = Math.round((a - b) / b * 100);
    return `<em class="${p > 0 ? 'up' : p < 0 ? 'down' : ''}">${p > 0 ? '↑' : p < 0 ? '↓' : '→'} ${Math.abs(p)}%</em>`;
  };

  const put = (el, html, force) => {
    const wasLoading = !!el.querySelector(':scope > .empty .spin');
    if (el.innerHTML === html) return;
    el.innerHTML = html;
    if ((wasLoading || force) && !el.querySelector(':scope > .empty .spin')) {
      el.classList.remove('fade-in'); void el.offsetWidth; el.classList.add('fade-in');
    }
  };

  let emptyN = 0;
  const emptyState = () => `<div class="empty"><i class="bx bx-bar-chart-alt-2"></i><span>${esc(t(['empty', 'empty2', 'empty3'][emptyN++ % 3]))}</span></div>`;
  const loadingState = () => '<div class="empty"><span class="spin"></span></div>';
  const noRows = () => stats ? emptyState() : loadingState();
  const list = (rows, name, o = {}) => {
    rows = (rows || []).slice(0, o.limit || 999);
    if (!rows.length) return noRows();
    const max = Math.max(1, ...rows.map(r => r.n));
    const total = rows.reduce((a, r) => a + r.n, 0);
    return '<ol class="rk">' + rows.map(r =>
      `<li style="--p:${Math.max(2, r.n / max * 100).toFixed(1)}%">` +
      `<span class="rk-n">${o.icon ? `<i class="bx ${o.icon(r.k)}"></i>` : ''}${o.code ? `<span class="cc">${esc(r.k)}</span>` : ''}<span>${esc(name(r.k))}</span></span>` +
      `<b>${nf(r.n)}${o.share && total ? `<small>${nf(r.n / total * 100, { maximumFractionDigits: 0 })}%</small>` : ''}</b></li>`).join('') + '</ol>';
  };

  const deviceRows = rows => {
    rows = rows || [];
    if (!rows.reduce((a, r) => a + r.n, 0)) return noRows();
    const all = ['desktop', 'mobile', 'tablet'].map(k => ({ k, n: rows.find(r => r.k === k)?.n || 0 }));
    return list(all, k => t(DEV[k]), { icon: k => DEV_ICON[k], share: true, max: true });
  };

  const countriesBlock = (o = {}) => list(stats?.countries, region, { code: true, ...o });

  const niceMax = v => { if (v <= 4) return v <= 2 ? 2 : 4; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) { const t = m * p; if (t >= v && t % 2 === 0) return t; } return 10 * p; };
  const chart = (el, daily, o = {}) => {
    daily = daily || [];
    if (!daily.length) { el.innerHTML = noRows(); delete el.dataset.k; return; }
    const k = o.metric || 'v', N = daily.length;
    const top = niceMax(Math.max(1, ...daily.map(d => d[k] || 0)));
    const fmt = new Intl.DateTimeFormat(lang(), { month: 'short', day: 'numeric' });
    const fmtL = new Intl.DateTimeFormat(lang(), { weekday: 'short', month: 'short', day: 'numeric' });
    const L = N - 1, axisIdx = new Set([0, Math.round(L / 3), Math.round(2 * L / 3), L]);
    const empty = daily.every(d => !d[k]);
    const html =
      `<div class="ch-y">${[top, top / 2, 0].map(v => `<span>${nf(v, { notation: 'compact' })}</span>`).join('')}</div>` +
      `<div class="bplot"><div class="bgrid"><i></i><i></i><i></i></div><div class="bcols">` +
      daily.map((d, i) => {
        const h = ((d[k] || 0) / top * 100).toFixed(2);
        return `<div class="bc${i === L ? ' now' : ''}" style="--h:${h}%"><i style="height:${h}%"></i>` +
          `<span class="tip${i > N * .75 ? ' left' : i < N * .25 ? ' right' : ''}"><b>${esc(fmtL.format(new Date(d.day)))}</b>` +
          `<span>${esc(t('kv'))}<em>${nf(d.v || 0)}</em></span><span>${esc(t('kp'))}<em>${nf(d.n || 0)}</em></span></span></div>`;
      }).join('') +
      `</div>${empty ? `<div class="ch-empty"><span>${esc(t(['empty', 'empty2', 'empty3'][emptyN++ % 3]))}</span></div>` : ''}</div>` +
      `<div class="ch-x">${daily.map((d, i) => `<span>${axisIdx.has(i) ? `<b>${esc(fmt.format(new Date(d.day)))}</b>` : ''}</span>`).join('')}</div>`;
    const cols = el.querySelectorAll('.bc');
    if (cols.length === N && el.dataset.k === k) {
      const tmp = document.createElement('div'); tmp.innerHTML = html;
      tmp.querySelectorAll('.bc').forEach((c, i) => { cols[i].style.cssText = c.style.cssText; cols[i].firstChild.style.height = c.firstChild.style.height; cols[i].querySelector('.tip').replaceWith(c.querySelector('.tip')); });
      el.querySelector('.ch-y').replaceWith(tmp.querySelector('.ch-y'));
      el.querySelector('.ch-x').replaceWith(tmp.querySelector('.ch-x'));
      el.querySelector('.ch-empty')?.remove(); const ce = tmp.querySelector('.ch-empty'); if (ce) el.querySelector('.bplot').appendChild(ce);
      return;
    }
    el.dataset.k = k;
    el.innerHTML = html;
  };

  const insights = s => {
    const out = [];
    if (s.prev_visitors) {
      const p = Math.round((s.visitors - s.prev_visitors) / s.prev_visitors * 100);
      out.push(p > 0 ? tf('insUp', { p, d: days }) : p < 0 ? tf('insDown', { p: -p, d: days }) : t('insSame'));
    }
    const peak = (s.daily || []).reduce((a, d) => (d.v || 0) > (a?.v || 0) ? d : a, null);
    if (peak && peak.v) out.push(tf('insPeak', { d: new Intl.DateTimeFormat(lang(), { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(peak.day)), n: nf(peak.v) }));
    return out.length ? out : [t('insNone')];
  };

  const TITLES = { overview: null, pages: ['nPg'], sources: ['nSrc'], audience: ['nAud'], tech: ['nTech'], settings: ['nSet'], profile: ['prH'], verify: ['vt'] };
  let editingTitle = false;
  const renderHead = view => {
    const s = site();
    $('vhead').hidden = view === 'new';
    const tt = TITLES[view];
    if (!editingTitle) $('vTitle').textContent = tt ? t(tt[0]) : label(s);
    $('vEdit').hidden = editingTitle || view !== 'overview' || !s || !canManage(s);
    $('vSub').textContent = tt ? (tt[1] ? t(tt[1]) : '') : (s && label(s) !== s.domain ? s.domain : '');
    $('range').innerHTML = [7, 14, 30].map(n => `<button type="button" data-d="${n}" aria-pressed="${n === days}">${n}${esc(t('dunit'))}</button>`).join('');
    $('upd').textContent = lastAt ? `${t('rfd')} ${lastAt.toLocaleTimeString(lang(), { hour: '2-digit', minute: '2-digit' })}` : '';
  };

  const renderSwitcher = () => {
    const s = site();
    paintAva($('swAva'), s); $('swName').textContent = label(s); $('swDom').textContent = s && label(s) !== s.domain ? s.domain : '';
    const q = $('swQ').value.trim().toLowerCase();
    const shown = sites.filter(x => !q || label(x).toLowerCase().includes(q) || x.domain.includes(q));
    $('swList').innerHTML = shown.length ? shown.map(x =>
      `<li role="option" aria-selected="${x.id === cur}"><button type="button" data-site="${x.id}"><span class="ava"></span><span class="sw-txt"><b>${esc(label(x))}</b>${label(x) !== x.domain ? `<small>${esc(x.domain)}</small>` : ''}</span>` +
      (isOwner(x) ? '' : `<span class="role-tag">${esc(t(roleOf(x) === 'manage' ? 'roleM' : 'roleV'))}</span>`) +
      `<i class="bx ${x.verified ? 'bx-badge-check ok' : 'bx-time-five'}"></i></button></li>`).join('')
      : `<li class="none">${esc(t('noMatch'))}</li>`;
    $('swList').querySelectorAll('[data-site]').forEach(b => paintAva(b.querySelector('.ava'), sites.find(x => x.id === b.dataset.site)));
    $('swPop').querySelector('.sw-find').hidden = sites.length < 6;
  };

  const renderOverview = () => {
    const s = stats; const box = document.querySelector('[data-view=overview]');
    box.classList.toggle('loading', !s);
    if (!s) { $('metrics').innerHTML = ''; $('chart').innerHTML = '<div class="empty"><span class="spin"></span></div>'; ['ovPages', 'ovSrc', 'ovCtry', 'ovDev'].forEach(id => { $(id).innerHTML = loadingState(); }); $('ins').textContent = ''; return; }
    const m = [
      { id: 'v', lbl: 'kv', val: s.visitors || 0, d: delta(s.visitors, s.prev_visitors), f: v => nf(Math.round(v)) },
      { id: 'n', lbl: 'kp', val: s.pageviews || 0, d: delta(s.pageviews, s.prev_pageviews), f: v => nf(Math.round(v)) },
      { id: 'b', lbl: 'kb', val: s.bounce || 0, f: v => Math.round(v) + '%' },
      { id: 'o', lbl: 'online', val: s.online || 0, f: v => nf(Math.round(v)), live: true }
    ];
    if (!$('metrics').querySelector('[data-m]')) {
      $('metrics').innerHTML = m.map(x => {
        const tag = x.id === 'v' || x.id === 'n' ? 'button type="button"' : 'div';
        return `<${tag} class="mt" data-m="${x.id}"><span class="lbl">${x.live ? '<i class="dot"></i>' : ''}<span></span></span><span class="mt-v"><b></b><span class="mt-d"></span></span></${tag.split(' ')[0]}>`;
      }).join('');
    }
    m.forEach(x => {
      const el = $('metrics').querySelector(`[data-m="${x.id}"]`);
      if (el.tagName === 'BUTTON') el.setAttribute('aria-pressed', String(x.id === metric));
      el.querySelector('.lbl span').textContent = t(x.lbl);
      tween(el.querySelector('b'), x.val, x.f);
      el.querySelector('.mt-d').innerHTML = x.d || '';
    });
    chart($('chart'), s.daily, { id: 'main', metric });
    $('ins').textContent = insights(s).slice(0, 2).join(' ');
    put($('ovPages'), list(s.pages, x => x, { limit: 5 }));
    put($('ovSrc'), list(s.sources, srcName, { limit: 5 }));
    put($('ovDev'), deviceRows(s.devices));
    put($('ovCtry'), countriesBlock({ limit: 3 }));
  };

  const sumRow = (el, items) => {
    el.innerHTML = items.map(([lbl, val, sub]) =>
      `<div class="mt"><span class="lbl">${esc(lbl)}</span><span class="mt-v"><b>${val}</b></span>${sub ? `<small>${sub}</small>` : ''}</div>`).join('');
  };
  const reportChart = (titleEl, chartEl, m, id) => {
    titleEl.textContent = tf('byDay', { m: t(m === 'n' ? 'kp' : 'kv') });
    chart(chartEl, stats?.daily, { id, metric: m });
  };
  const top = (rows, name) => rows?.[0] ? esc(name(rows[0].k)) : '—';
  const topSub = rows => rows?.[0] ? nf(rows[0].n) : '';

  const renderPages = () => {
    const s = stats || {};
    sumRow($('sumP'), [[t('kp'), nf(s.pageviews || 0)], [t('kr'), nf(s.per_visitor || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 })], [t('topP'), top(s.pages, x => x), topSub(s.pages)]]);
    reportChart($('chTP'), $('chP'), 'n', 'p');
    const q = $('pgQ').value.trim().toLowerCase();
    const rows = (stats?.pages || []).filter(r => !q || r.k.toLowerCase().includes(q));
    put($('pgTable'), q && !rows.length ? `<p class="none">${esc(t('noMatch'))}</p>` : list(rows, k => k));
  };
  const renderSources = () => {
    const s = stats || {};
    sumRow($('sumS'), [[t('kv'), nf(s.visitors || 0)], [t('cntS'), nf((s.sources || []).length)], [t('topS'), top(s.sources, srcName), topSub(s.sources)]]);
    reportChart($('chTS'), $('chS'), 'v', 's');
    put($('srcTable'), list(s.sources, srcName));
    const st = site(); if (st && !$('lbUrl').value) $('lbUrl').value = `https://${st.domain}/`;
    buildLink();
  };
  const buildLink = () => {
    const name = $('lbSrc').value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    let out = '';
    try { const u = new URL($('lbUrl').value.trim()); if (name) u.searchParams.set('ref', name); out = u.href; } catch { out = ''; }
    $('lbOut').textContent = out;
  };
  const renderAudience = () => {
    const s = stats || {}, rows = s.countries || [];
    sumRow($('sumA'), [[t('kv'), nf(s.visitors || 0)], [t('cntC'), nf(rows.length)], [t('topC'), top(rows, region), topSub(rows)]]);
    reportChart($('chTA'), $('chA'), 'v', 'a');
    put($('audTable'), countriesBlock());
  };
  const renderTech = () => {
    const s = stats || {}, devs = s.devices || [];
    const total = devs.reduce((a, r) => a + r.n, 0);
    sumRow($('tDevices'), ['desktop', 'mobile', 'tablet'].map(k => {
      const n = devs.find(r => r.k === k)?.n || 0;
      return [t(DEV[k]), total ? nf(n / total * 100, { maximumFractionDigits: 0 }) + '%' : '—', total ? nf(n) : ''];
    }));
    reportChart($('chTT'), $('chT'), 'v', 't');
    $('techTabs').innerHTML = [['browsers', 'tb'], ['systems', 'to']].map(([k, l]) => `<button type="button" data-ttab="${k}" aria-selected="${k === techTab}">${esc(t(l))}</button>`).join('');
    $('techTh').textContent = t(techTab === 'browsers' ? 'thBrowser' : 'thOS');
    put($('techTable'), list(s[techTab], sysName, { share: true }), tabSwitched); tabSwitched = false;
  };

  const stepper = (el, at) => {
    el.innerHTML = ['ob1', 'ob2', 'ob3'].map((k, i) =>
      `<li class="${i < at ? 'done' : i === at ? 'on' : ''}"><span>${i < at ? '<i class="bx bx-check"></i>' : i + 1}</span>${esc(t(k))}</li>`).join('');
  };
  const renderVerify = () => {
    const s = site(); if (!s) return;
    stepper($('vStep'), 1);
    $('vcode').textContent = snippet(s.id);
    $('vHome').innerHTML = esc(t('vWhereD')).replace('{u}', `<b>https://${esc(s.domain)}/</b>`);
    $('dnsN').textContent = '_codeq.' + s.domain; $('dnsV').textContent = 'codeq-verify=' + s.id;
    $('dnsNHint').innerHTML = esc(t('dnsNHint')).replace('{n}', '<code>_codeq</code>');
  };

  const renderSettings = () => {
    const s = site(); if (!s) return;
    if (document.activeElement !== $('nm')) $('nm').value = s.name || '';
    $('nm').placeholder = s.title || s.domain;
    syncSaveName();
    $('sDom').textContent = s.domain;
    $('sStat').innerHTML = `<span class="badge ${s.verified ? 'ok' : ''}"><i class="bx ${s.verified ? 'bx-badge-check' : 'bx-time-five'}"></i>${esc(t(s.verified ? 'ver' : 'pend'))}</span>`;
    $('inst').textContent = snippet(s.id);
    $('sMeta').textContent = s.title || '—';
    const own = isOwner(s), mng = canManage(s);
    $('nm').readOnly = !mng; $('nsave').hidden = !mng;
    $('mrf').hidden = !mng;
    if (!own) closeMove();
    $('mvOpen').hidden = !own || !$('mvRow').hidden;
    document.querySelectorAll('.dz-row').forEach(row => {
      const k = row.dataset.dz;
      if (k === 'delete') setCmd(row, tf('cmdDel', { d: s.domain }));
      row.hidden = k === 'reset' ? !(s.verified && mng) : k === 'delete' ? !own : k === 'leave' ? isCreator(s) : true;
    });
    renderAccess();
    paintHandover();
  };

  let members = [], membersFor = null;
  const accRoleSeg = (el, role, attr) => {
    el.innerHTML = ROLES.map(([k, l]) =>
      `<button type="button" ${attr}="${k}" aria-pressed="${k === role}">${esc(t(l))}</button>`).join('');
  };
  let inviteRole = 'view';
  let ownerOf = {};
  const loadMembers = async () => {
    const s = site(); if (!s) return;
    const id = s.id;
    let { data, error } = await sb.rpc('site_people', { p_site: id });
    if (id !== cur) return;
    if (error && isOwner(s)) {
      const r = await sb.from('site_members').select('email,role,created_at').eq('site_id', id).order('created_at');
      data = { members: r.data || [] };
    }
    if (id !== cur) return;
    members = data?.members || []; ownerOf[id] = data?.owner || null; membersFor = id;
    renderAccess(); paintHandover();
  };
  const heir = () => members.find(m => m.role === 'owner' && m.status === 'accepted');
  const norm = v => String(v ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  function setCmd(box, cmd) {
    box.dataset.cmd = cmd;
    const lbl = box.querySelector('.dz-label'), inp = box.querySelector('.dz-in, #ownIn');
    if (lbl) lbl.innerHTML = esc(t('dzType')).replace('{d}', `<b class="cmd">${esc(cmd)}</b>`);
    if (inp) inp.placeholder = '';
  }
  const cmdOk = (box, value) => !!box.dataset.cmd && norm(value) === norm(box.dataset.cmd);
  function paintHandover() {
    const s = site(), row = document.querySelector('.dz-row[data-dz="handover"]'); if (!s || !row) return;
    const h = isCreator(s) && membersFor === s.id ? heir() : null;
    row.hidden = !h;
    if (h) { $('hoD').textContent = tf('hoD', { who: h.person?.name || h.email }); setCmd(row, tf('cmdHo', { e: h.email })); }
  }
  function renderAccess() {
    const s = site(); if (!s) return;
    const own = isOwner(s);
    $('accOwner').hidden = !own; $('accList').hidden = !own; $('accMember').hidden = own; $('accBy').hidden = own;
    if (membersFor !== s.id) { $('accList').innerHTML = ''; $('accByP').innerHTML = ''; loadMembers(); }
    if (!own) {
      $('accYou').textContent = t(roleOf(s) === 'manage' ? 'roleM' : 'roleV');
      const o = ownerOf[s.id];
      $('accBy').hidden = !o;
      if (o) { $('accByP').innerHTML = personHtml(o); paintPeople($('accByP')); }
      return;
    }
    accRoleSeg($('accRole'), inviteRole, 'data-inv-role');
    if (membersFor !== s.id) return;
    const creator = ownerOf[s.id] ? `<div class="srow acc-m acc-creator"><span class="sl">${personHtml(ownerOf[s.id])}<span class="role-tag">${esc(t('accCreator'))}</span></span><div class="sv"><span class="mut">${esc(t('roleO'))}</span></div></div>` : '';
    $('accList').innerHTML = creator + (members.length ? members.map(m => {
      const wait = m.status === 'pending';
      return `<div class="srow acc-m"><span class="sl">${personHtml(m.person || { email: m.email })}${wait ? `<span class="role-tag">${esc(t('accPend'))}</span>` : ''}</span><div class="sv sv-split">` +
      `<div class="seg" data-acc="${esc(m.email)}">${ROLES.map(([k, l]) =>
        `<button type="button" data-acc-role="${k}" aria-pressed="${k === m.role}">${esc(t(l))}</button>`).join('')}</div>` +
      `<button class="btn sm ghost" type="button" data-acc-rm="${esc(m.email)}">${esc(t(wait ? 'accCancel' : 'accRm'))}</button></div></div>`;
    }).join('')
      : `<div class="srow acc-none"><span class="sl"></span><div class="sv">${esc(t('accNone'))}</div></div>`);
    paintPeople($('accList'));
  }
  const accSay = (text, bad) => say($('accMsg'), text, bad);
  $('accGo').onclick = async () => {
    const s = site(), b = $('accGo'); if (!s || !isOwner(s) || b.disabled) return;
    const email = $('accEmail').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { accSay(t('bad'), true); $('accEmail').focus(); return; }
    if (email === myEmail()) { accSay(t('accSelf'), true); return; }
    if (members.some(m => m.email === email)) { accSay(t('accDup'), true); return; }
    if (inviteRole === 'owner') { accSay(''); return openOwn(email, true); }
    accSay(''); b.disabled = true; b.classList.add('loading');
    const { error } = await sb.from('site_members').insert({ site_id: s.id, email, role: inviteRole });
    b.disabled = false; b.classList.remove('loading');
    if (error) { accSay(t(error.code === '23505' ? 'accDup' : error.code === '54000' ? 'accMany' : 'err'), true); return; }
    $('accEmail').value = ''; toast(t('accAdded'));
    membersFor = null; renderAccess();
  };
  $('accEmail').addEventListener('keydown', e => { if (e.key === 'Enter') $('accGo').click(); });
  $('accEmail').addEventListener('input', () => { if ($('accMsg').textContent) accSay(''); });
  const setMemberRole = async (email, role) => {
    const m = members.find(x => x.email === email); if (!m || m.role === role) return;
    if (role === 'owner') return openOwn(email, false);
    const { error } = await sb.from('site_members').update({ role }).eq('site_id', cur).eq('email', email);
    if (error) return toast(t('err'), 'bad');
    m.role = role; renderAccess();
  };
  const removeMember = async email => {
    const { error } = await sb.from('site_members').delete().eq('site_id', cur).eq('email', email);
    if (error) return toast(t('err'), 'bad');
    const was = members.find(m => m.email === email);
    members = members.filter(m => m.email !== email); renderAccess(); toast(t(was?.status === 'pending' ? 'accWithdrawn' : 'accRemoved'));
  };
  let ownFor = null;
  function openOwn(email, invite) {
    const s = site(); if (!s) return;
    const m = members.find(x => x.email === email);
    ownFor = { email, invite };
    $('ownD').textContent = tf('ownD', { who: m?.person?.name || email });
    setCmd($('ownRow'), tf('cmdOwn', { e: email }));
    $('ownIn').value = ''; $('ownGo').disabled = true; say($('ownMsg'), '');
    $('ownRow').hidden = false;
    $('ownRow').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setTimeout(() => $('ownIn').focus({ preventScroll: true }), 60);
  }
  function closeOwn() { ownFor = null; $('ownRow').hidden = true; $('ownIn').value = ''; }
  $('ownCancel').onclick = closeOwn;
  $('ownIn').addEventListener('input', () => { $('ownGo').disabled = !cmdOk($('ownRow'), $('ownIn').value); if ($('ownMsg').textContent) say($('ownMsg'), ''); });
  $('ownIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('ownGo').click(); if (e.key === 'Escape') closeOwn(); });
  $('ownGo').onclick = async () => {
    const s = site(), b = $('ownGo'); if (!s || !ownFor || b.disabled) return;
    b.disabled = true; b.classList.add('loading');
    const { error } = await sb.rpc('owner_grant', { p_site: s.id, p_email: ownFor.email, p_confirm: ownFor.email });
    b.classList.remove('loading');
    if (error) {
      b.disabled = false;
      return say($('ownMsg'), t(error.code === '42501' ? 'notOwner' : error.code === '54000' ? 'accMany' : 'err'), true);
    }
    const invite = ownFor.invite;
    closeOwn();
    if (invite) { $('accEmail').value = ''; inviteRole = 'view'; }
    toast(t(invite ? 'accAdded' : 'ownDone'));
    membersFor = null; renderAccess();
  };

  const closeDz = () => document.querySelectorAll('.dz-row').forEach(r => {
    r.classList.remove('open'); r.querySelector('.dz-confirm').hidden = true;
    const inp = r.querySelector('.dz-in'), go = r.querySelector('[data-dz-go]');
    go.classList.remove('loading');
    if (inp) { inp.value = ''; go.disabled = true; } else go.disabled = false;
  });

  const renderProfile = () => {
    const m = meta();
    $('pfAva').innerHTML = ''; paintMe($('pfAva'));
    $('pfRm').hidden = !myAvatar();
    if (!$('pfName').matches(':focus')) $('pfName').value = m.cq_name || '';
    $('pfName').placeholder = m.full_name || m.name || t('dnPh');
    syncSaveProfile();
    $('pfMail').textContent = user.email || '—';
    const th = document.documentElement.dataset.theme;
    const bars = [38, 56, 44, 70, 52, 84, 64].map((h, i, a) => `<i style="height:${h}%"${i === a.length - 1 ? ' class="last"' : ''}></i>`).join('');
    $('themeSeg').innerHTML = [['dark', 'thD'], ['light', 'thL']].map(([k, l]) =>
      `<button type="button" class="tp" data-theme-set="${k}" aria-pressed="${k === th}">` +
      `<span class="tp-prev tp-${k}"><span class="tp-card"><span class="tp-line"></span><span class="tp-bars">${bars}</span></span></span>` +
      `<span class="tp-l"><span class="tp-dot"></span>${esc(t(l))}</span></button>`).join('');
    $('langSeg').innerHTML = I18N.langs.map(([code, name]) => `<button type="button" lang="${code}" data-lang-set="${code}" aria-pressed="${code === I18N.cur}">${esc(name)}</button>`).join('');
    $('rfSeg').innerHTML = RF_OPTS.map(n => `<button type="button" data-rf="${n}" aria-pressed="${n === refreshSec}">${n ? esc(n + t('secUnit')) : esc(t('off'))}</button>`).join('');
  };
  const saveMeta = async data => {
    const { data: res, error } = await sb.auth.updateUser({ data });
    if (error) throw error;
    user = res.user; paintHeader();
  };

  const AV_MAX = 2 * 1024 * 1024, AV_DIM = 1024;
  const AV_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
  const AV_FILES = Object.values(AV_TYPES).map(e => `avatar.${e}`);
  const loadImg = file => new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
    img.src = url;
  });
  const encode = (cv, type) => new Promise(res => cv.toBlob(b => res(b), type, .9));
  const toAvatar = async file => {
    const img = await loadImg(file);
    const w = img.naturalWidth, h = img.naturalHeight;
    if (AV_TYPES[file.type] && file.size <= AV_MAX && Math.max(w, h) <= AV_DIM) return { blob: file, type: file.type };
    const k = Math.min(1, AV_DIM / Math.max(w, h)), cv = document.createElement('canvas');
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    let type = AV_TYPES[file.type] ? file.type : 'image/png';
    let blob = await encode(cv, type);
    if (!blob || blob.size > AV_MAX) { type = 'image/webp'; blob = await encode(cv, type); }
    if (!blob || blob.size > AV_MAX) throw new Error('too big');
    return { blob, type };
  };
  $('pfFile').onchange = async () => {
    const f = $('pfFile').files[0]; $('pfFile').value = '';
    if (!f) return;
    const lbl = document.querySelector('label[for=pfFile]'); lbl.classList.add('loading');
    try {
      const { blob, type } = await toAvatar(f);
      const name = `avatar.${AV_TYPES[type]}`, path = `${user.id}/${name}`;
      const { error } = await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: type, cacheControl: '3600' });
      if (error) throw error;
      await sb.storage.from('avatars').remove(AV_FILES.filter(n => n !== name).map(n => `${user.id}/${n}`)).catch(() => {});
      const { data } = sb.storage.from('avatars').getPublicUrl(path);
      await saveMeta({ cq_avatar: `${data.publicUrl}?v=${Date.now()}` });
      renderProfile(); toast(t('prSaved'));
    } catch (e) { console.error('[avatar]', e); toast(t('avErr'), 'bad'); }
    lbl.classList.remove('loading');
  };
  $('pfRm').onclick = async () => {
    const b = $('pfRm'); b.disabled = true;
    try {
      await sb.storage.from('avatars').remove(AV_FILES.map(n => `${user.id}/${n}`));
      await saveMeta({ cq_avatar: 'none' });
      renderProfile();
    } catch (e) { toast(t('err'), 'bad'); }
    b.disabled = false;
  };
  function syncSaveProfile() { $('pfSave').disabled = ($('pfName').value.trim().slice(0, 50) || '') === (meta().cq_name || ''); }
  $('pfName').addEventListener('input', syncSaveProfile);
  $('pfSave').onclick = async () => {
    if ($('pfSave').disabled) return;
    const msg = $('pfMsg'); msg.textContent = '';
    const b = $('pfSave'); b.disabled = true; b.classList.add('loading');
    try {
      await saveMeta({ cq_name: $('pfName').value.trim().slice(0, 50) || null });
      toast(t('prSaved'));
    } catch (e) { msg.dataset.state = 'bad'; msg.textContent = t('err'); }
    b.classList.remove('loading'); syncSaveProfile();
  };
  $('pfName').addEventListener('keydown', e => { if (e.key === 'Enter') $('pfSave').click(); });

  const RF_OPTS = [0, 10, 20, 30, 60];
  let refreshSec = (() => {
    const v = +store.get('refreshSec');
    if (RF_OPTS.includes(v) && store.get('refreshSec') !== null) return v;
    return store.get('autoRefresh') === '0' ? 0 : 20;
  })();
  let rfTimer = null;
  const schedule = () => {
    clearTimeout(rfTimer);
    if (refreshSec) rfTimer = setTimeout(async () => { if (!document.hidden) await refresh(); schedule(); }, refreshSec * 1000);
  };

  const renderNew = () => {
    const first = !sites.length;
    stepper($('nStep'), 0);
    $('newH').textContent = t(first ? 'obFirstH' : 'obH');
    $('newSub').textContent = t(first ? 'obFirstSub' : 'obSub');
    $('newBack').hidden = first;
    const today = new Date(), demo = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - 13 + i);
      const v = Math.round(18 + i * 2.2 + Math.sin(i * 1.3) * 7 + (i % 7 === 5 ? -6 : 0));
      return { day: d.toISOString().slice(0, 10), v, n: Math.round(v * 2.4 + Math.cos(i) * 5) };
    });
    $('pvMetrics').innerHTML = [['kv', nf(412)], ['kp', nf(1038)], ['kb', '41%']].map(([k, v], i) => `<div class="mt"><span class="lbl">${esc(t(k))}</span><span class="mt-v"><b>${v}</b></span></div>`).join('');
    chart($('pvChart'), demo, { id: 'pv' });
  };

  const STAT_VIEWS = ['overview', 'pages', 'sources', 'audience', 'tech'];
  const ROUTES = [...STAT_VIEWS, 'settings', 'profile', 'new'];
  const parse = () => { let r = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]; if (r === 'account') r = 'profile'; return ROUTES.includes(r) ? r : 'overview'; };
  const go = r => { if (location.hash !== '#/' + r) location.hash = '#/' + r; else show(); };

  function show() {
    route = parse();
    if (!sites.length && route !== 'profile') route = 'new';
    const s = site();
    const unverified = s && !s.verified;
    if (unverified && STAT_VIEWS.includes(route) && route !== 'overview') route = 'overview';
    const view = route === 'overview' && unverified ? 'verify' : route;

    finishBoot();
    $('rail').hidden = !sites.length;
    $('shell').classList.toggle('solo', !sites.length);
    document.querySelectorAll('#tabs a').forEach(a => {
      a.setAttribute('aria-current', a.dataset.r === route ? 'page' : 'false');
      a.hidden = unverified && a.hasAttribute('data-stats');
    });
    $('tools').hidden = !(s?.verified && STAT_VIEWS.includes(route));
    const prevView = currentView();
    document.querySelectorAll('[data-view]').forEach(v => {
      const on = v.dataset.view === view;
      v.hidden = !on;
      if (on && prevView !== view) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
    });
    document.title = `${t({ overview: 'nOv', pages: 'nPg', sources: 'nSrc', audience: 'nAud', tech: 'nTech', settings: 'nSet', profile: 'prH', new: 'add' }[route])} · codeq analytics`;
    if (view !== 'settings') { closeDz(); closeMove(); closeOwn(); }
    renderView(view);
    closeSwitcher();
  }
  const renderView = view => {
    renderSwitcher(); renderHead(view);
    ({ overview: renderOverview, verify: renderVerify, pages: renderPages, sources: renderSources, audience: renderAudience,
       tech: renderTech, settings: renderSettings, profile: renderProfile, new: renderNew })[view]?.();
  };
  const currentView = () => document.querySelector('[data-view]:not([hidden])')?.dataset.view;
  addEventListener('hashchange', () => { show(); scrollTo({ top: 0 }); });

  const refresh = async () => {
    const s = site(); if (!s?.verified) return false;
    const want = cur;
    const { data, error } = await sb.rpc('site_stats', { p_site: cur, p_days: days });
    if (want !== cur) return false;
    if (error) {
      if (error.code === '42501' && !isOwner(s)) lostAccess(s.id, label(s), 'access_removed');
      else console.error('[site_stats]', error.message);
      return false;
    }
    lastAt = new Date();
    const key = JSON.stringify(data);
    const v = currentView();
    if (key !== statsKey) { stats = data; statsKey = key; if (STAT_VIEWS.includes(v)) renderView(v); else renderHead(v); }
    else renderHead(v);
    return true;
  };
  const resetStats = () => { stats = null; statsKey = ''; lastAt = null; $('metrics').innerHTML = ''; };
  const load = async () => {
    let { data, error } = await sb.from('sites').select('id,user_id,domain,verified,name,title,icon,meta_at').order('created_at');
    if (error) {
      console.warn('[sites] full select failed, falling back:', error.message);
      ({ data } = await sb.from('sites').select('id,domain,verified,name').order('created_at'));
      (data || []).forEach(s => { s.meta_at = 'skip'; if (s.name === s.domain) s.name = null; });
    }
    sites = data || [];
    const shared = sites.filter(s => s.user_id && s.user_id !== user.id);
    if (shared.length) {
      const { data: mem } = await sb.from('site_members').select('site_id,email,role').eq('email', myEmail());
      shared.forEach(s => { s.role = (mem || []).find(m => m.site_id === s.id)?.role || 'view'; });
    }
    sites.sort((a, b) => (isOwner(a) ? 0 : 1) - (isOwner(b) ? 0 : 1));
    if (!sites.some(s => s.id === cur)) cur = sites[0]?.id || null;
    cur ? store.set('site', cur) : store.del('site');
    resetStats();
    show();
    refresh();
    const todo = sites.filter(s => !s.meta_at && s.domain !== 'localhost');
    if (todo.length) Promise.all(todo.map(s => askMeta(s.id))).then(() => renderView(currentView()));
  };
  const selectSite = id => {
    if (id === cur) return closeSwitcher();
    cur = id; store.set('site', cur); resetStats(); closeMove(); closeOwn(); membersFor = null; members = [];
    if (!STAT_VIEWS.includes(route) && route !== 'settings') go('overview'); else show();
    refresh();
  };

  const openSwitcher = () => {
    $('swPop').hidden = false; $('swBtn').setAttribute('aria-expanded', 'true');
    $('swQ').placeholder = t('swFind'); renderSwitcher();
    requestAnimationFrame(() => $('swPop').classList.add('open'));
    if (sites.length >= 6) setTimeout(() => $('swQ').focus(), 50);
  };
  function closeSwitcher() {
    if ($('swPop').hidden) return;
    $('swPop').classList.remove('open'); $('swBtn').setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!$('swPop').classList.contains('open')) $('swPop').hidden = true; }, 150);
    $('swQ').value = '';
  }
  $('swBtn').onclick = () => $('swPop').hidden ? openSwitcher() : closeSwitcher();
  $('swQ').oninput = renderSwitcher;
  document.addEventListener('click', e => { if (!$('sw').contains(e.target)) closeSwitcher(); });

  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.site) selectSite(b.dataset.site);
    else if (b.dataset.d) { days = +b.dataset.d; store.set('days', days); resetStats(); renderView(currentView()); refresh(); }
    else if (b.dataset.m && b.closest('#metrics') && (b.dataset.m === 'v' || b.dataset.m === 'n')) { metric = b.dataset.m; store.set('metric', metric); renderOverview(); }
    else if (b.dataset.ttab) { if (b.dataset.ttab !== techTab) tabSwitched = true; techTab = b.dataset.ttab; store.set('techTab', techTab); renderTech(); }
    else if (b.dataset.langSet) { I18N.set(b.dataset.langSet); }
    else if (b.dataset.invRole) { inviteRole = b.dataset.invRole; accRoleSeg($('accRole'), inviteRole, 'data-inv-role'); }
    else if (b.dataset.accRole) setMemberRole(b.closest('[data-acc]').dataset.acc, b.dataset.accRole);
    else if (b.dataset.accRm) removeMember(b.dataset.accRm);
    else if (b.dataset.rf !== undefined) { refreshSec = +b.dataset.rf; store.set('refreshSec', refreshSec); store.del('autoRefresh'); schedule(); renderProfile(); }
    else if (b.dataset.themeSet) { if (document.documentElement.dataset.theme !== b.dataset.themeSet) $('theme').click(); }
    else if (b.dataset.dzOpen) {
      closeDz();
      const row = b.closest('.dz-row'); row.classList.add('open'); row.querySelector('.dz-confirm').hidden = false;
      setTimeout(() => (row.querySelector('.dz-in') || row.querySelector('[data-dz-go]')).focus(), 50);
    }
    else if (b.hasAttribute('data-dz-cancel')) closeDz();
    else if (b.dataset.dzGo) dangerGo(b);
    else if (b.dataset.copy) {
      const text = $(b.dataset.copy).textContent; if (!text) return;
      try { await navigator.clipboard.writeText(text); } catch { return toast(t('err'), 'bad'); }
      const i = b.querySelector('i'); if (i) { i.className = 'bx bx-check'; setTimeout(() => { i.className = 'bx bx-copy'; }, 1500); }
      toast(t('copied'));
    }
  });
  document.addEventListener('input', e => {
    if (!e.target.classList.contains('dz-in')) return;
    const row = e.target.closest('.dz-row');
    row.querySelector('[data-dz-go]').disabled = !cmdOk(row, e.target.value);
  });

  const dangerGo = async b => {
    if (b.disabled) return;
    b.disabled = true; b.classList.add('loading');
    if (b.dataset.dzGo === 'leave') {
      const { error } = await sb.from('site_members').delete().eq('site_id', cur).eq('email', myEmail());
      b.classList.remove('loading');
      if (error) { b.disabled = false; return toast(t('err'), 'bad'); }
      closeDz(); store.del('site'); cur = null; toast(t('lvDone'));
      location.hash = '#/overview';
      await load();
    } else if (b.dataset.dzGo === 'handover') {
      const { data, error } = await sb.rpc('leave_site', { p_site: cur, p_confirm: heir()?.email || '' });
      b.classList.remove('loading');
      if (error) { b.disabled = false; console.error('[leave_site]', error.message); return toast(t(error.hint === 'noowner' ? 'hoNone' : 'err'), 'bad'); }
      const to = members.find(m => m.email === data?.to);
      closeDz(); store.del('site'); cur = null; toast(tf('hoDone', { who: to?.person?.name || data?.to || '' }));
      location.hash = '#/overview';
      await load();
    } else if (b.dataset.dzGo === 'reset') {
      const { error } = await sb.rpc('reset_site_stats', { p_site: cur });
      b.classList.remove('loading');
      if (error) { b.disabled = false; console.error('[reset]', error.message); return toast(t('err'), 'bad'); }
      closeDz(); resetStats(); toast(t('rsDone')); refresh();
    } else {
      const { error } = await sb.from('sites').delete().eq('id', cur);
      b.classList.remove('loading');
      if (error) { b.disabled = false; return toast(t('err'), 'bad'); }
      closeDz(); store.del('site'); cur = null; toast(t('deld'));
      location.hash = '#/overview';
      await load();
    }
  };

  $('rf').onclick = async () => {
    const b = $('rf'); if (b.disabled) return;
    b.disabled = true; b.classList.add('spinning');
    await refresh();
    b.disabled = false; b.classList.remove('spinning');
  };

  const normDomain = raw => {
    let d = String(raw || '').trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0].split(':')[0];
    try { d = new URL('http://' + d).hostname; } catch {  }
    return d.replace(/^www\./, '');
  };
  const domainProblem = d =>
    d.length > 253 || !/^(localhost|([a-z0-9-]+\.)+([a-z]{2,}|xn--[a-z0-9-]+))$/.test(d) ? 'baddom'
      : /(^|\.)(example\.(com|net|org)|example|test|invalid|localhost|local|home\.arpa)$/.test(d) && d !== 'localhost' ? 'resdom' : '';

  const verify = async (id, domain) => {
    const { data, error } = await sb.functions.invoke('verify', { body: domain ? { site: id, domain } : { site: id } });
    return data || (error?.context?.json ? await error.context.json().catch(() => null) : null) || { ok: false };
  };
  $('vbtn').onclick = async () => {
    const b = $('vbtn'); b.disabled = true; b.classList.add('loading');
    const r = await verify(cur);
    b.disabled = false; b.classList.remove('loading');
    if (r.ok) { toast(t('vok')); await load(); } else toast(t(r.reason === 'taken' ? 'vtaken' : r.reason === 'notfound' ? 'vfail' : r.reason === 'notowner' ? 'notOwner' : 'err'), 'bad');
  };

  const say = (el, text, bad) => { el.dataset.state = bad ? 'bad' : 'ok'; el.textContent = text; };
  $('save').onclick = async () => {
    const d = normDomain($('dom').value);
    const m = $('mmsg'), b = $('save');
    const bad = domainProblem(d);
    if (bad) { say(m, t(bad), true); $('dom').focus(); return; }
    if (sites.some(s => s.domain === d)) { say(m, t('dupOwn'), true); $('dom').focus(); return; }
    const { data: taken, error: takenErr } = await sb.rpc('domain_taken', { p_domain: d });
    if (!takenErr && taken === true) { say(m, t('vtaken'), true); $('dom').focus(); return; }
    say(m, '');
    b.disabled = true; b.classList.add('loading');
    const { data, error } = await sb.from('sites').insert({ domain: d }).select('id').single();
    if (error) { b.disabled = false; b.classList.remove('loading'); return say(m, t('err'), true); }
    if (d === 'localhost') await verify(data.id);
    b.disabled = false; b.classList.remove('loading');
    $('dom').value = '';
    cur = data.id; store.set('site', cur); toast(t('added'));
    location.hash = '#/overview';
    await load();
  };
  $('dom').addEventListener('keydown', e => { if (e.key === 'Enter') $('save').click(); });
  $('dom').addEventListener('input', () => { if ($('mmsg').textContent) say($('mmsg'), ''); });

  function syncSaveName() { const s = site(); $('nsave').disabled = !s || ($('nm').value.trim().slice(0, 80) || '') === (s.name || ''); }
  $('nm').addEventListener('input', syncSaveName);
  $('nsave').onclick = async () => {
    const b = $('nsave'), v = $('nm').value.trim().slice(0, 80) || null;
    if (b.disabled) return;
    b.disabled = true; b.classList.add('loading');
    const { error } = await sb.from('sites').update({ name: v }).eq('id', cur);
    b.classList.remove('loading');
    if (error) { syncSaveName(); return toast(t('err'), 'bad'); }
    site().name = v; renderSwitcher(); renderHead(currentView()); syncSaveName(); toast(t('nsaved'));
  };
  $('nm').addEventListener('keydown', e => { if (e.key === 'Enter') $('nsave').click(); });

  const sizeTitleIn = () => { $('vTitleIn').style.width = Math.max(6, $('vTitleIn').value.length + 2) + 'ch'; };
  const startRename = () => {
    const s = site(); if (!s || !canManage(s)) return;
    editingTitle = true;
    const inp = $('vTitleIn');
    inp.value = label(s); inp.placeholder = s.title || s.domain; sizeTitleIn();
    $('vTitle').hidden = true; $('vEdit').hidden = true; inp.hidden = false;
    inp.focus(); inp.select();
  };
  const endRename = async keep => {
    if (!editingTitle) return;
    editingTitle = false;
    const inp = $('vTitleIn'), s = site();
    inp.hidden = true; $('vTitle').hidden = false;
    if (keep && s) {
      let v = inp.value.trim().slice(0, 80) || null;
      if (v && v === (s.title || s.domain)) v = null;
      if (v !== (s.name || null)) {
        const { error } = await sb.from('sites').update({ name: v }).eq('id', s.id);
        if (error) toast(t('err'), 'bad'); else { s.name = v; toast(t('nsaved')); }
      }
    }
    renderSwitcher(); renderHead(currentView());
  };
  $('vEdit').onclick = startRename;
  $('vTitleIn').addEventListener('input', sizeTitleIn);
  $('vTitleIn').addEventListener('blur', () => endRename(true));
  $('vTitleIn').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); endRename(true); }
    if (e.key === 'Escape') { e.stopPropagation(); endRename(false); }
  });

  const mvHint = () => {
    const s = site(); if (!s) return;
    const d = normDomain($('mvDom').value) || '…';
    $('mvHint').innerHTML = esc(t('mvHint'))
      .replace('{n}', `<code>_codeq.${esc(d)}</code>`).replace('{v}', `<code>codeq-verify=${esc(s.id)}</code>`);
  };
  const closeMove = () => { $('mvRow').hidden = true; $('mvOpen').hidden = !isOwner(site()); $('mvDom').value = ''; say($('mvMsg'), ''); };
  $('mvOpen').onclick = () => { $('mvRow').hidden = false; $('mvOpen').hidden = true; mvHint(); syncMove(); setTimeout(() => $('mvDom').focus(), 30); };
  $('mvCancel').onclick = closeMove;
  const syncMove = () => { $('mvGo').disabled = !$('mvDom').value.trim(); };
  $('mvDom').addEventListener('input', () => { mvHint(); syncMove(); if ($('mvMsg').textContent) say($('mvMsg'), ''); });
  $('mvDom').addEventListener('keydown', e => { if (e.key === 'Enter') $('mvGo').click(); if (e.key === 'Escape') closeMove(); });
  $('mvGo').onclick = async () => {
    const s = site(), d = normDomain($('mvDom').value), m = $('mvMsg'), b = $('mvGo');
    if (!s || b.disabled) return;
    const bad = domainProblem(d);
    if (bad) { say(m, t(bad), true); $('mvDom').focus(); return; }
    if (d === s.domain) { say(m, t('mvSame'), true); return; }
    say(m, ''); b.disabled = true; b.classList.add('loading');
    const r = await verify(s.id, d);
    b.classList.remove('loading'); syncMove();
    if (!r.ok) {
      say(m, r.reason === 'taken' ? t('vtaken') : r.reason === 'notfound' ? tf('mvFail', { d }) : r.reason === 'baddomain' ? t('baddom') : r.reason === 'notowner' ? t('notOwner') : t('err'), true);
      return;
    }
    closeMove(); toast(tf('mvDone', { d }));
    await load();
  };
  $('mrf').onclick = async () => {
    const b = $('mrf'); b.disabled = true; b.classList.add('loading');
    const ok = await askMeta(cur);
    b.disabled = false; b.classList.remove('loading');
    if (!ok) return toast(t('err'), 'bad');
    renderSettings(); renderSwitcher(); toast(t('rfd'));
  };

  const PH_SRC = ['telegram', 'discord', 'instagram', 'youtube', 'newsletter', 'reddit', 'whatsapp', 'linkedin', 'tiktok', 'facebook'];
  let phI = 0;
  setInterval(() => {
    const el = $('lbSrc');
    if (el.value || document.hidden || currentView() !== 'sources') return;
    const next = () => { phI = (phI + 1) % PH_SRC.length; el.placeholder = PH_SRC[phI]; };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return next();
    el.classList.add('ph-out');
    setTimeout(() => { next(); el.classList.remove('ph-out'); }, 380);
  }, 2800);

  $('lbUrl').oninput = $('lbSrc').oninput = buildLink;
  $('pgQ').oninput = renderPages;

  addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSwitcher(); closeDz(); }
    if (e.key === '/' && currentView() === 'pages' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('pgQ').focus(); }
  });

  document.addEventListener('themechange', () => { if (currentView() === 'profile') renderProfile(); });
  document.addEventListener('langchange', () => {
    $('pgQ').placeholder = t('filt'); $('swQ').placeholder = t('swFind');
    if (sites.length || route === 'new' || route === 'profile') show();
  });
  $('pgQ').placeholder = t('filt');

  let notes = [], notesReady = false, liveOk = false, ntfErr = '';
  const hasBell = !!$('bell');
  const NT_ICON = { invite: 'bx-user-plus', invite_accepted: 'bx-user-check', invite_declined: 'bx-user-x', member_left: 'bx-exit',
    member_renamed: 'bx-pencil', member_reset: 'bx-reset', access_removed: 'bx-lock-alt', role_changed: 'bx-shield-quarter',
    site_deleted: 'bx-trash', site_moved: 'bx-transfer-alt', first_visit: 'bx-party', site_transferred: 'bx-crown' };
  const NT_WHO = { invite_accepted: 'nMember', invite_declined: 'nMember', member_left: 'nMember', member_renamed: 'nMember', member_reset: 'nMember',
    access_removed: 'nOwner', role_changed: 'nOwner', site_deleted: 'nOwner', site_moved: 'nOwner', site_transferred: 'nPrevOwner' };
  const q = x => tf('q', { s: x || '—' });
  const roleName = r => t(r === 'owner' ? 'roleO' : r === 'manage' ? 'roleM' : 'roleV').toLowerCase();
  const waiting = n => n.kind === 'invite' && !n.data?.answer && n.site_id;
  const siteOf = n => n.site_label || n.data?.label || '';
  const domainOf = n => n.data?.domain || sites.find(s => s.id === (n.site_id || n.data?.site))?.domain || '';
  const siteFull = n => {
    const l = siteOf(n), d = domainOf(n);
    return !l ? d : d && d !== l ? `${q(l)} (${d})` : q(l);
  };
  const ago = iso => {
    const s = (new Date(iso) - Date.now()) / 1000, rtf = new Intl.RelativeTimeFormat(lang(), { numeric: 'auto' });
    for (const [u, k] of [['day', 86400], ['hour', 3600], ['minute', 60]]) if (Math.abs(s) >= k || u === 'minute') {
      if (u === 'day' && Math.abs(s) >= 7 * 86400) return new Date(iso).toLocaleDateString(lang(), { day: 'numeric', month: 'short' });
      return rtf.format(Math.round(s / k), u);
    }
  };
  const ntTitle = n => t('nk_' + n.kind);
  const ntText = n => {
    const d = n.data || {};
    const role = d.role || members.find(m => m.email === n.actor?.email)?.role;
    return tf('nd_' + n.kind, {
      site: n.kind === 'site_moved' ? (siteOf(n) ? q(siteOf(n)) : d.to) : siteFull(n), domain: domainOf(n) || q(siteOf(n)), role: role ? roleName(role) : '—',
      roleD: role ? t(role === 'owner' ? 'nRoleO' : role === 'manage' ? 'nRoleM' : 'nRoleV') : '', from: n.kind === 'site_moved' ? d.from : q(d.from),
      to: n.kind === 'site_moved' ? d.to : q(d.to)
    }).replace(/\s+/g, ' ').trim();
  };
  const who = (label, p) => p ? `<div class="nt-who"><span class="nt-l">${esc(t(label))}</span>${personHtml(p)}</div>` : '';
  const ntHtml = n => {
    const d = n.data || {}, open = waiting(n);
    let extra = '';
    if (n.kind === 'invite') {
      const owner = d.owner || n.actor, by = n.actor && owner && n.actor.email !== owner.email ? n.actor : null;
      extra = who('nOwner', owner) + (by ? who('nBy', by) : '') + (open
        ? `<div class="nt-act"><button class="btn solid sm" type="button" data-nt-yes="${n.id}">${esc(t('nAccept'))}</button>` +
          `<button class="btn sm" type="button" data-nt-no="${n.id}">${esc(t('nDecline'))}</button></div>`
        : `<span class="nt-ans">${esc(t('nAns_' + (d.answer || 'cancelled')))}</span>`);
    } else if (NT_WHO[n.kind]) extra = who(NT_WHO[n.kind], n.actor);
    return `<div class="nt${!n.read_at || open ? ' new' : ''}${n.fresh ? ' fresh' : ''}" data-nt="${n.id}"><span class="nt-ic"><i class="bx ${NT_ICON[n.kind] || 'bx-bell'}"></i></span>` +
      `<div class="nt-b"><b>${esc(ntTitle(n))}</b><p class="nt-t">${esc(ntText(n))}</p>${extra}<time>${esc(ago(n.created_at))}</time></div>` +
      (open ? '' : `<button class="nt-x" type="button" data-nt-x="${n.id}"><i class="bx bx-x"></i></button>`) + '</div>';
  };
  const paintBell = () => {
    if (!notesReady || !hasBell) return;
    const k = notes.filter(n => !n.read_at || waiting(n)).length, badge = $('bellN'), had = !badge.hidden;
    badge.textContent = k > 9 ? '9+' : k;
    if (k && !had) { badge.hidden = false; badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop'); }
    if (!k) badge.hidden = true;
    $('bell').firstElementChild.className = 'bx ' + (k ? 'bxs-bell' : 'bx-bell');
    if ($('ntfPop').hidden) return;
    $('ntfList').innerHTML = (ntfErr ? `<p class="ntf-err" role="status">${esc(ntfErr)}</p>` : '') + (notes.length ? notes.map(ntHtml).join('')
      : `<div class="empty"><i class="bx bx-bell-off"></i><span>${esc(t('ntfNone'))}</span></div>`);
    notes.forEach(n => { delete n.fresh; });
    $('ntfClear').disabled = !notes.some(n => !waiting(n));
    paintPeople($('ntfList'));
  };
  const ring = () => {
    const b = $('bell'); b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring');
  };
  const fetchNotes = async () => {
    const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) { if (!notesReady) console.warn('[notifications] not installed yet:', error.message); return null; }
    return data || [];
  };
  const arrive = n => {
    if (!n || !NT_ICON[n.kind] || notes.some(x => x.id === n.id)) return;
    n.fresh = true;
    notes.unshift(n); notes.length = Math.min(notes.length, 50);
    paintBell(); ring();
    const sid = n.site_id || n.data?.site;
    if (n.kind === 'access_removed' || n.kind === 'site_deleted') return lostAccess(sid);
    if (n.kind === 'role_changed' || n.kind === 'site_moved' || n.kind === 'member_renamed' || n.kind === 'site_transferred') { membersFor = null; load(); }
    else if ((n.kind === 'member_reset' || n.kind === 'first_visit') && sid === cur) { resetStats(); refresh(); }
    else if (/^invite_|^member_left$/.test(n.kind) && sid === cur) { membersFor = null; if (currentView() === 'settings') renderAccess(); }
  };
  async function lostAccess(id) {
    const was = sites.find(s => s.id === id);
    if (!was) return;
    sites = sites.filter(s => s.id !== id);
    if (cur === id) { cur = null; store.del('site'); closeDz(); closeMove(); location.hash = '#/overview'; openNotes(); }
    await load();
  }
  const syncNotes = async () => {
    const data = await fetchNotes(); if (!data) return;
    const fresh = data.filter(n => !notes.some(x => x.id === n.id)).reverse();
    if (!notesReady) { notes = data; notesReady = true; $('ntf').hidden = false; paintBell(); return true; }
    data.forEach(n => { const i = notes.findIndex(x => x.id === n.id); if (i >= 0) notes[i] = n; });
    notes = notes.filter(x => data.some(n => n.id === x.id) || x.id > (data[data.length - 1]?.id || 0));
    fresh.forEach(arrive);
    paintBell();
    return true;
  };
  function openNotes() {
    if (!hasBell) return;
    if (!$('ntfPop').hidden) return paintBell();
    ntfErr = '';
    $('ntfPop').hidden = false; $('bell').setAttribute('aria-expanded', 'true');
    paintBell();
    requestAnimationFrame(() => $('ntfPop').classList.add('open'));
  }
  function closeNotes() {
    if (!hasBell || $('ntfPop').hidden) return;
    $('ntfPop').classList.remove('open'); $('bell').setAttribute('aria-expanded', 'false');
    const now = new Date().toISOString(), seen = notes.filter(n => !n.read_at && !waiting(n));
    if (seen.length) {
      seen.forEach(n => { n.read_at = now; });
      sb.from('notifications').update({ read_at: now }).in('id', seen.map(n => n.id)).then(({ error }) => { if (error) console.warn('[notifications] read:', error.message); });
    }
    setTimeout(() => { if (!$('ntfPop').classList.contains('open')) $('ntfPop').hidden = true; paintBell(); }, 180);
  }
  const ntfFail = msg => { ntfErr = msg; paintBell(); };
  if (hasBell) $('bell').onclick = () => $('ntfPop').hidden ? openNotes() : closeNotes();
  document.addEventListener('click', e => { if (hasBell && !$('ntf').contains(e.target)) closeNotes(); });
  const fold = id => new Promise(res => {
    const el = $('ntfList').querySelector(`[data-nt="${id}"]`);
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return res();
    el.style.height = el.offsetHeight + 'px'; void el.offsetWidth;
    el.classList.add('gone'); setTimeout(res, 220);
  });
  if (hasBell) $('ntfClear').onclick = async () => {
    const ids = notes.filter(n => !waiting(n)).map(n => n.id); if (!ids.length) return;
    const { error } = await sb.from('notifications').delete().in('id', ids);
    if (error) return ntfFail(t('err'));
    ntfErr = '';
    await Promise.all(ids.map(fold));
    notes = notes.filter(n => waiting(n)); paintBell();
  };
  if (hasBell) $('ntfList').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    e.stopPropagation();
    const id = +(b.dataset.ntX || b.dataset.ntYes || b.dataset.ntNo), n = notes.find(x => x.id === id); if (!n) return;
    if (b.dataset.ntX) {
      const { error } = await sb.from('notifications').delete().eq('id', id);
      if (error) return ntfFail(t('err'));
      ntfErr = '';
      await fold(id);
      notes = notes.filter(x => x.id !== id); return paintBell();
    }
    const yes = !!b.dataset.ntYes;
    b.closest('.nt-act').querySelectorAll('button').forEach(x => { x.disabled = true; });
    b.classList.add('loading');
    const { error } = await sb.rpc(yes ? 'accept_invite' : 'decline_invite', { p_site: n.site_id });
    if (error) {
      if (error.code === 'P0002') { n.data = { ...n.data, answer: 'cancelled' }; n.read_at = n.read_at || new Date().toISOString(); return ntfFail(t('nGone')); }
      return ntfFail(t('err'));
    }
    ntfErr = '';
    n.data = { ...n.data, answer: yes ? 'accepted' : 'declined' }; n.read_at = new Date().toISOString();
    paintBell();
    if (!yes) return;
    await load();
    if (sites.some(s => s.id === n.site_id)) { closeNotes(); selectSite(n.site_id); go('overview'); }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeNotes(); });
  document.addEventListener('langchange', paintBell);
  const startNotes = async () => {
    if (!hasBell) return;
    if (!(await syncNotes())) return;
    try {
      sb.channel('notes-' + user.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, p => arrive(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, p => {
          const i = notes.findIndex(x => x.id === p.new.id); if (i >= 0) { notes[i] = p.new; paintBell(); }
        })
        .subscribe(st => { liveOk = st === 'SUBSCRIBED'; });
    } catch (err) { console.warn('[notifications] live updates off:', err.message); }
    setInterval(() => { if (!liveOk && !document.hidden) syncNotes(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNotes(); });
    setInterval(() => { if (!$('ntfPop').hidden) paintBell(); }, 60000);
  };

  schedule();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && refreshSec) { refresh(); schedule(); } });
  load().then(startNotes);
})();
