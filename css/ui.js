(() => {
  const root = document.documentElement;
  const logo = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" aria-hidden="true"><g transform="translate(4 -1)"><circle cx="28" cy="30" r="16"/><path d="M44 14v38"/><circle cx="28" cy="30" r="3" fill="currentColor" stroke="none"/></g></svg>';
  const app = document.body.dataset.page === 'app';
  const ext = 'target="_blank" rel="noopener"';
  const R = root.dataset.root || '';
  const HOME = R || './';

  const bell = '<div class="ntf" id="ntf" hidden><button class="icon-btn" id="bell" type="button" aria-expanded="false" aria-haspopup="true"><i class="bx bx-bell"></i><b class="ntf-n" id="bellN" hidden></b></button>' +
    '<div class="ntf-pop" id="ntfPop" hidden><div class="ntf-h"><b data-i18n="ntfH">Notifications</b><button class="btn sm ghost" id="ntfClear" type="button" data-i18n="ntfClear">Clear</button></div><div class="ntf-list" id="ntfList"></div></div></div>';

  document.getElementById('top').innerHTML = `<div class="bar wrap"><a class="brand" href="${HOME}">${logo}<span>codeq analytics</span></a><div class="bar-r">${app ? '<button class="chip who" id="who" type="button"></button><button class="btn sm" id="out" type="button"><i class="bx bx-log-out"></i><span data-i18n="out">Sign out</span></button>' + bell : ''}<button class="icon-btn" id="theme" type="button"><i class="bx bx-sun"></i></button></div></div>`;
  document.getElementById('bottom').innerHTML = `<div class="foot wrap"><span>© 2026 codeq analytics</span><nav class="links"><a href="${R}legal/?doc=privacy" ${ext} data-i18n="priv">Privacy</a><a href="${R}legal/?doc=terms" ${ext} data-i18n="tos">Terms</a></nav><div class="select" id="lang"><button class="select-btn" type="button" aria-haspopup="listbox" aria-expanded="false"><i class="bx bx-globe"></i><span id="langName">English</span><i class="bx bx-chevron-up"></i></button><ul class="select-list" role="listbox" hidden></ul></div></div>`;

  document.querySelectorAll('a[href*="legal/"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });

  const header = document.getElementById('top');
  const measure = () => {
    const top = parseFloat(getComputedStyle(header).top) || 0;
    root.style.setProperty('--stick', Math.round(header.offsetHeight + top + 12) + 'px');
  };
  measure();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(header); else addEventListener('resize', measure);

  const themeBtn = document.getElementById('theme');
  const paintTheme = () => themeBtn.firstElementChild.className = 'bx ' + (root.dataset.theme === 'dark' ? 'bx-sun' : 'bx-moon');
  const applyTheme = theme => {
    root.dataset.theme = theme;
    paintTheme();
    document.dispatchEvent(new Event('themechange'));
  };
  themeBtn.onclick = () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch (e) {}
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(() => applyTheme(next));
    else applyTheme(next);
  };
  paintTheme();

  const box = document.getElementById('lang');
  const btn = box.querySelector('.select-btn');
  const list = box.querySelector('.select-list');
  const open = v => {
    list.hidden = !v;
    btn.setAttribute('aria-expanded', String(v));
    if (v) (list.querySelector('[aria-selected="true"]') || list.querySelector('li'))?.focus();
  };
  const paintList = () => {
    list.innerHTML = '';
    I18N.langs.forEach(([code, label]) => {
      const li = document.createElement('li');
      li.tabIndex = -1; li.lang = code; li.dataset.code = code;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', code === I18N.cur);
      li.innerHTML = `<span>${label}</span>` + (code === I18N.cur ? '<i class="bx bx-check"></i>' : '');
      list.appendChild(li);
    });
    document.getElementById('langName').textContent = I18N.langs.find(l => l[0] === I18N.cur)[1];
  };
  btn.onclick = () => open(list.hidden);
  list.onclick = e => {
    const li = e.target.closest('li');
    if (li) { I18N.set(li.dataset.code); open(false); btn.focus(); }
  };
  list.onkeydown = e => {
    const li = document.activeElement;
    if (e.key === 'ArrowDown') (li.nextElementSibling || list.firstChild).focus();
    else if (e.key === 'ArrowUp') (li.previousElementSibling || list.lastChild).focus();
    else if (e.key === 'Enter' || e.key === ' ') li.click();
    else if (e.key === 'Escape' || e.key === 'Tab') { open(false); btn.focus(); }
    else return;
    e.preventDefault();
  };
  document.addEventListener('click', e => { if (!box.contains(e.target)) open(false); });
  document.addEventListener('langchange', paintList);

  addEventListener('storage', e => {
    if (e.key === 'lang' && e.newValue) I18N.set(e.newValue);
    if (e.key === 'theme' && e.newValue) applyTheme(e.newValue);
  });

  I18N.set(I18N.cur);

  const watch = el => new MutationObserver(() => {
    el.classList.remove('msg-in');
    if (el.textContent.trim()) { void el.offsetWidth; el.classList.add('msg-in'); }
  }).observe(el, { childList: true, characterData: true, subtree: true });
  document.querySelectorAll('[role="status"]').forEach(watch);

  const bars = document.getElementById('bars'), n = document.getElementById('liveN');
  if (bars) {
    const data = Array.from({ length: 24 }, () => 20 + Math.random() * 70);
    bars.innerHTML = '<i></i>'.repeat(24);
    const draw = () => {
      [...bars.children].forEach((b, i) => b.style.height = data[i] + '%');
      n.textContent = Math.max(1, Math.round(data[23] / 5));
    };
    draw();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInterval(() => {
        data.push(Math.max(15, Math.min(95, data[23] + (Math.random() - .5) * 30)));
        data.shift();
        draw();
      }, 2200);
    }
  }
  const onScroll = () => document.body.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
