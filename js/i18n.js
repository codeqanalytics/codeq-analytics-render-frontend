(() => {
  const langs = [['zh', '中文'], ['nl', 'Nederlands'], ['en', 'English'], ['fr', 'Français'], ['it', 'Italiano'], ['ru', 'Русский'], ['es', 'Español']];
  const dict = window.STRINGS;
  const saved = localStorage.getItem('lang');
  const initial = langs.some(([code]) => code === saved) ? saved : 'en';

  const I18N = {
    dict, langs, cur: initial,
    t(key) { return this.dict[this.cur]?.[key] ?? this.dict.en[key] ?? key; },
    set(code) {
      if (!this.dict[code]) return;
      this.cur = code;
      localStorage.setItem('lang', code);
      document.documentElement.lang = code === 'zh' ? 'zh-Hans' : code;
      document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
      document.dispatchEvent(new Event('langchange'));
    }
  };
  window.I18N = I18N;
  I18N.set(initial);
})();