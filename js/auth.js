(() => {
  const cfg = window.CODEQ_CONFIG, lib = window.supabase, root = document.documentElement;
  const form = document.getElementById('emailForm'), emailInput = document.getElementById('email'), message = document.getElementById('msg');
  const buttons = [...document.querySelectorAll('[data-provider], #emailForm [type="submit"]')];
  const t = k => I18N.t(k);
  const ready = () => root.classList.remove('booting');

  if (cfg && cfg.EMAIL_LOGIN === false) document.body.classList.add('no-email');

  if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.startsWith('YOUR-') || !lib?.createClient) {
    console.error('Check js/config.js and that the Supabase script loaded');
    ready();
    return;
  }
  const sb = lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const dashboardUrl = new URL('dashboard/', location.href).href;
  const back = location.href.split('#')[0].split('?')[0];

  const say = (text, bad = false, silent = false) => {
    message.textContent = text; message.dataset.state = bad ? 'bad' : 'ok';
    if (!silent && text) toast(text, bad ? 'bad' : 'ok');
  };
  const busy = (btn, on) => {
    buttons.forEach(b => { b.disabled = on; });
    emailInput.disabled = on;
    btn.classList.toggle('loading', on);
  };

  const paintLast = () => {
    document.querySelectorAll('.providers .tag').forEach(x => x.remove());
    const last = localStorage.getItem('lastProvider');
    const btn = last && document.querySelector(`[data-provider="${last}"]`);
    if (btn) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = t('lu'); btn.appendChild(tag); }
  };
  paintLast();
  document.addEventListener('langchange', paintLast);

  const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const random = n => b64url(crypto.getRandomValues(new Uint8Array(n)));
  const sha256 = async text => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const hex = bytes => [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
  const googleHere = async () => {
    const state = random(16), nonce = random(16), verifier = random(48);
    sessionStorage.setItem('gAuth', JSON.stringify({ state, nonce, verifier }));
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search = new URLSearchParams({
      client_id: cfg.GOOGLE_CLIENT_ID,
      redirect_uri: new URL('auth/google/', back).href,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce: hex(await sha256(nonce)),
      code_challenge: b64url(await sha256(verifier)),
      code_challenge_method: 'S256',
      prompt: 'select_account'
    });
    location.assign(u.href);
  };

  document.querySelectorAll('[data-provider]').forEach(btn => btn.addEventListener('click', async () => {
    localStorage.setItem('pendingAuth', btn.dataset.provider);
    if (btn.dataset.provider === 'google' && cfg.GOOGLE_CLIENT_ID && window.crypto?.subtle) {
      busy(btn, true);
      try { await googleHere(); } catch (e) { busy(btn, false); say(t('err'), true); console.error(e); }
      return;
    }
    busy(btn, true);
    const { error } = await sb.auth.signInWithOAuth({ provider: btn.dataset.provider, options: { redirectTo: back } });
    if (error) { busy(btn, false); say(t('err'), true); console.error(error); }
  }));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say(t('bad'), true, true); emailInput.focus(); return; }
    const btn = form.querySelector('[type="submit"]');
    say('', false, true);
    localStorage.setItem('pendingAuth', 'email');
    busy(btn, true);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: back } });
    busy(btn, false);
    error ? (say(t('err'), true), console.error(error)) : say(t('sent'));
  });

  sb.auth.onAuthStateChange((event, session) => {
    if (event !== 'SIGNED_IN' || !session) return;
    const p = localStorage.getItem('pendingAuth');
    if (p) { localStorage.setItem('lastProvider', p); localStorage.removeItem('pendingAuth'); }
    location.replace(dashboardUrl);
  });
  sb.auth.getSession().then(({ data }) => { if (data?.session) location.replace(dashboardUrl); else ready(); });
  setTimeout(ready, 5000);
})();