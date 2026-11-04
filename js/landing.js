(() => {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const io = new IntersectionObserver(list => list.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  document.querySelectorAll('.q').forEach(b => b.onclick = () => {
    const qa = b.closest('.qa'), wasOpen = qa.hasAttribute('data-open');
    document.querySelectorAll('.qa[data-open]').forEach(x => { x.removeAttribute('data-open'); x.querySelector('.q').setAttribute('aria-expanded', 'false'); });
    if (!wasOpen) { qa.setAttribute('data-open', ''); b.setAttribute('aria-expanded', 'true'); }
  });

  document.querySelectorAll('[data-top]').forEach(b => b.onclick = () => {
    scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
    setTimeout(() => document.getElementById('email')?.focus({ preventScroll: true }), calm ? 0 : 500);
  });

  const feed = document.getElementById('feed');
  if (feed) {
    const P = ['/', '/pricing', '/blog/we-have-no-cookies', '/docs', '/about', '/contact', '/changelog'];
    const C = ['JP', 'DE', 'BR', 'US', 'FR', 'NL', 'IT', 'ES', 'CN', 'CA', 'SE', 'KR'];
    const rnd = a => a[Math.floor(Math.random() * a.length)];
    const name = c => { try { return new Intl.DisplayNames([document.documentElement.lang], { type: 'region' }).of(c); } catch { return c; } };
    const add = () => {
      const c = rnd(C), li = document.createElement('li');
      li.className = 'rise';
      li.innerHTML = `<span>${rnd(P)}</span><em data-c="${c}">${name(c)}</em>`;
      feed.prepend(li);
      while (feed.children.length > 5) feed.lastChild.remove();
    };
    for (let i = 0; i < 5; i++) add();
    if (!calm) setInterval(add, 2400);
    document.addEventListener('langchange', () => feed.querySelectorAll('em').forEach(em => { em.textContent = name(em.dataset.c); }));
  }
})();