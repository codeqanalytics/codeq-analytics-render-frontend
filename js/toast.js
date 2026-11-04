(() => {
  let el = null, timer = null;
  const icon = kind => `bx ${kind === 'bad' ? 'bx-error-circle' : 'bx-check-circle'}`;
  const hide = () => {
    if (!el) return;
    const old = el; el = null;
    old.classList.add('out');
    setTimeout(() => old.remove(), 260);
  };
  window.toast = (text, kind = 'ok') => {
    if (el) {
      if (kind !== 'bad' || el.classList.contains('bad')) return;
      el.className = 'toast bad';
      el.firstChild.className = icon(kind);
      el.lastChild.textContent = text;
      clearTimeout(timer); timer = setTimeout(hide, 3600);
      return;
    }
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = `<i class="${icon(kind)}"></i><span></span>`;
    el.lastChild.textContent = text;
    box.appendChild(el);
    clearTimeout(timer); timer = setTimeout(hide, 3600);
  };
})();
