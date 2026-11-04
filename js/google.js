(async () => {
  const $ = id => document.getElementById(id);
  const t = k => I18N.t(k);
  const fail = (key, detail) => {
    if (detail) console.error('[google]', detail);
    $('gSpin').hidden = true;
    $('gMsg').textContent = t(key); $('gMsg').dataset.state = 'bad';
    $('gBack').hidden = false;
  };
  const q = new URLSearchParams(location.search);
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('gAuth') || 'null'); sessionStorage.removeItem('gAuth'); } catch {}
  const redirect = new URL('.', location.href).href.split('?')[0].split('#')[0];
  history.replaceState(null, '', redirect);

  if (q.get('error')) return fail(q.get('error') === 'access_denied' ? 'gDenied' : 'gFail', q.get('error'));
  if (!saved || !q.get('code') || q.get('state') !== saved.state) return fail('gFail', 'state mismatch or no code');

  const cfg = window.CODEQ_CONFIG;
  if (!window.supabase?.createClient) return fail('gFail', 'supabase-js did not load');
  const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  let token = '';
  try {
    const r = await fetch(`${cfg.SUPABASE_URL}/functions/v1/google-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ code: q.get('code'), redirect_uri: redirect, code_verifier: saved.verifier })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id_token) return fail(j.error === 'expired' ? 'gExpired' : 'gFail', j.error || r.status);
    token = j.id_token;
  } catch (e) { return fail('gFail', e); }

  const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token, nonce: saved.nonce });
  if (error) return fail('gFail', error.message);
  try { localStorage.setItem('lastProvider', 'google'); localStorage.removeItem('pendingAuth'); } catch {}
  location.replace(new URL('../../dashboard/', redirect).href);
})();
