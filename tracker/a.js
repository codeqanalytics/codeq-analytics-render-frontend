(() => {
  const el = document.currentScript;
  const site = el?.dataset.site;
  const api = el?.dataset.api;

  if (!site || !api || navigator.doNotTrack === '1') return;

  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}

  const params = new URLSearchParams(location.search);
  const tag = (params.get('utm_source') || params.get('ref') || params.get('source') || '').trim().slice(0, 60);

  const pageUrl = () => {
    const route = /^#!?\//.test(location.hash) ? location.hash.replace(/^#!?/, '').split('?')[0] : '';
    return location.origin + (route || location.pathname);
  };

  let last = '';
  let first = true;

  const send = async (name = 'pageview') => {
    const u = pageUrl();

    if (name === 'pageview') {
      if (u === last) return;
      last = u;
    }

    const data = { s: site, n: name, u, z: tz };

    if (first) {
      data.r = document.referrer;
      if (tag) data.q = tag;
      first = false;
    }

    try {
      const response = await fetch(api, {
        method: 'POST',
        keepalive: true,
        credentials: 'omit',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        console.error('[codeq] Событие не записано:', response.status, await response.text());
      }
    } catch (error) {
      console.error('[codeq] Ошибка отправки события:', error);
    }
  };

  const wrap = method => {
    const original = history[method];

    history[method] = function () {
      const result = original.apply(this, arguments);
      setTimeout(() => send(), 0);
      return result;
    };
  };

  wrap('pushState');
  wrap('replaceState');

  addEventListener('popstate', () => setTimeout(() => send(), 0));
  addEventListener('hashchange', () => setTimeout(() => send(), 0));

  window.codeq = send;
  send();
})();
