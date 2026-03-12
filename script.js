/* ══════════════════════════════════════════════════
   Suna — Islamic Daily Tracker
   Script
   ══════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── Developer Testing Mode ───
     Set these to non-null values to simulate different dates/times.
     Examples:
       TEST_HIJRI_DATE = { day: 9, month: 12 };  // يوم عرفة
       TEST_HIJRI_DATE = { day: 1, month: 9 };   // بداية رمضان
       TEST_TIME = '03:15';                       // last third of night
     Set back to null for production.             */
  const TEST_HIJRI_DATE = null;
  // { day: 10, month: 1 }
  const TEST_TIME = null;
  // '01:15'

  /* ─── Ramadan Detection ─── */
  let isRamadan = false;
  if (TEST_HIJRI_DATE && TEST_HIJRI_DATE.month === 9) {
    isRamadan = true;
  } else if (!TEST_HIJRI_DATE) {
    try {
      const partsFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
        day: 'numeric', month: 'numeric', year: 'numeric',
      });
      const parts = partsFmt.formatToParts(new Date());
      parts.forEach(p => {
        if (p.type === 'month' && parseInt(p.value, 10) === 9) isRamadan = true;
      });
    } catch { /* fallback: not Ramadan */ }
  }

  /* ─── Constants ─── */
  const THEME_KEY  = 'suna-theme';
  const DATA_KEY   = 'suna-data';
  const TAB_KEY    = 'suna-active-tab';

  const FARD_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  const SUNNAH_PRAYERS = [
    { id: 'before_fajr',   rakaa: 2 },
    { id: 'before_dhuhr',  rakaa: 4 },
    { id: 'after_dhuhr',   rakaa: 2 },
    { id: 'after_maghrib', rakaa: 2 },
    { id: 'after_isha',    rakaa: 2 },
  ];
  const SUNNAH_TOTAL = SUNNAH_PRAYERS.reduce((s, p) => s + p.rakaa, 0); // 12

  const OPTIONAL_DEFS = {
    tatawwu: { name: 'تطوع',  step: 2 },
  };

  const COUNTER_KEYS = [
    'subhanallah', 'alhamdulillah', 'la_ilaha', 'allahu_akbar',
    'la_hawla', 'subhan_bihamdi', 'astaghfirullah',
    'la_ilaha_wahdah', 'salat_ibrahimiya',
  ];

  const ATHKAR_OPTIONAL_DEFS = {
    exit_dua: {
      name: 'دعاء الخروج من المنزل',
      duaaText: 'بسمِ اللهِ توكَّلتُ على اللهِ اللَّهمَّ إنِّي أعوذُ بك أن أضِلَّ أو أُضَلَّ أو أزِلَّ أو أُزلَّ أو أظلِمَ أو أُظلَمَ أو أجهَلَ أو يُجهلَ عليَّ.',
    },
  };

  const QURAN_TOTAL_PAGES = 604;

  const QURAN_OPTIONAL_DEFS = {
    baqara:   { name: 'سورة البقرة' },
    imran:    { name: 'سورة آل عمران' },
    new_hifz: { name: 'الحفظ الجديد' },
    review:   { name: 'مراجعة المحفوظ' },
  };

  /* ─── DOM References ─── */
  const btnTheme     = document.getElementById('btn-theme');
  const tabs         = document.querySelectorAll('.tab');
  const panels       = document.querySelectorAll('.tab-panel');
  const indicator    = document.querySelector('.tabs__indicator');
  const fardBadge    = document.getElementById('fard-badge');
  const sunnahBadge  = document.getElementById('sunnah-badge');
  const fardList     = document.getElementById('fard-list');
  const sunnahList   = document.getElementById('sunnah-list');
  const optionalList = document.getElementById('optional-list');
  const btnAddOpt    = document.getElementById('btn-add-optional');
  const optionalMenu = document.getElementById('optional-menu');

  // Athkar
  const athkarBadge       = document.getElementById('athkar-badge');
  const athkarMandList    = document.getElementById('athkar-mandatory-list');
  const athkarCountersEl  = document.getElementById('athkar-counters');
  const athkarOptList     = document.getElementById('athkar-optional-list');
  const btnAddAthkarOpt   = document.getElementById('btn-add-athkar-optional');
  const athkarOptMenu     = document.getElementById('athkar-optional-menu');

  // Quran
  const quranBadge        = document.getElementById('quran-badge');
  const quranPagesInput   = document.getElementById('quran-pages-input');
  const quranProgressBar  = document.getElementById('quran-progress-bar');
  const quranProgressText = document.getElementById('quran-progress-text');
  const quranOptList      = document.getElementById('quran-optional-list');
  const btnAddQuranOpt    = document.getElementById('btn-add-quran-optional');
  const quranOptMenu      = document.getElementById('quran-optional-menu');

  // Date label
  const currentDateEl     = document.getElementById('current-date');

  /* ═══════════════════════════════════════
     Data Layer
     ═══════════════════════════════════════ */
  function todayKey() {
    return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  }

  function getDefaultDay() {
    const defaultCounters = {};
    COUNTER_KEYS.forEach(k => defaultCounters[k] = 0);
    return {
      date: todayKey(),
      fard: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
      sunnah: { before_fajr: false, before_dhuhr: false, after_dhuhr: false, after_maghrib: false, after_isha: false },
      nafl: {
        duha: { done: false, rakaa: 2 },
        qiyam: { done: false, rakaa: 1 },
      },
      optional: {},
      athkarMandatory: { morning: false, evening: false },
      athkarMorningCounts: {},
      athkarEveningCounts: {},
      athkarCounters: defaultCounters,
      athkarOptional: {},
      customDuaa: [],  // e.g. [{ id: 'xxx', name: 'دعاء', checked: false }]
      quranPages: 0,
      quranOptional: {},  // e.g. { baqara: { checked: false } }  — included in stats
      fasting: { today: false, dawud: false },
      ramadanFasting: { fasted: false, excused: false, noExcuse: false },
      ramadanTaraweeh: false,
    };
  }

  function loadAllData() {
    try {
      return JSON.parse(localStorage.getItem(DATA_KEY)) || {};
    } catch { return {}; }
  }

  function loadToday() {
    const all = loadAllData();
    const key = todayKey();
    if (!all[key]) all[key] = getDefaultDay();
    // Ensure new fields exist for older saved data
    const day = all[key];
    if (!day.athkarMandatory) day.athkarMandatory = { morning: false, evening: false };
    if (!day.athkarMorningCounts) day.athkarMorningCounts = {};
    if (!day.athkarEveningCounts) day.athkarEveningCounts = {};
    if (!day.athkarCounters) { const c = {}; COUNTER_KEYS.forEach(k => c[k] = 0); day.athkarCounters = c; }
    if (!day.athkarOptional) day.athkarOptional = {};
    if (!Array.isArray(day.customDuaa)) day.customDuaa = [];
    if (day.quranPages === undefined) day.quranPages = 0;
    if (!day.quranOptional) day.quranOptional = {};
    if (!day.fasting) day.fasting = { today: false, dawud: false };
    if (!day.ramadanFasting) day.ramadanFasting = { fasted: false, excused: false, noExcuse: false };
    if (day.ramadanTaraweeh === undefined) day.ramadanTaraweeh = false;
    // Normalize nafl structure (support legacy numeric values)
    if (!day.nafl) {
      day.nafl = {
        duha: { done: false, rakaa: 2 },
        qiyam: { done: false, rakaa: 1 },
      };
    } else {
      // Duha
      if (typeof day.nafl.duha === 'number') {
        const v = day.nafl.duha;
        day.nafl.duha = {
          done: v > 0,
          rakaa: v > 0 ? v : 2,
        };
      } else if (!day.nafl.duha) {
        day.nafl.duha = { done: false, rakaa: 2 };
      }
      // Qiyam
      if (typeof day.nafl.qiyam === 'number') {
        const v = day.nafl.qiyam;
        day.nafl.qiyam = {
          done: v > 0,
          rakaa: v > 0 ? v : 1,
        };
      } else if (!day.nafl.qiyam) {
        day.nafl.qiyam = { done: false, rakaa: 1 };
      }
    }
    return day;
  }

  function saveToday(day) {
    const all = loadAllData();
    all[todayKey()] = day;
    localStorage.setItem(DATA_KEY, JSON.stringify(all));
  }

  let today = loadToday();

  /* ═══════════════════════════════════════
     Theme Toggle
     ═══════════════════════════════════════ */
  function getStoredTheme() { return localStorage.getItem(THEME_KEY); }

  function getPreferredTheme() {
    const stored = getStoredTheme();
    return stored || 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  applyTheme(getPreferredTheme());

  btnTheme.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!getStoredTheme()) applyTheme(e.matches ? 'dark' : 'light');
  });

  /* ═══════════════════════════════════════
     Tab Switching
     ═══════════════════════════════════════ */
  function moveIndicator(tab) {
    indicator.style.width = tab.offsetWidth + 'px';
    indicator.style.left  = tab.offsetLeft  + 'px';
  }

  function activateTab(target) {
    tabs.forEach(t => {
      const isActive = t === target;
      t.classList.toggle('tab--active', isActive);
      t.setAttribute('aria-selected', isActive);
    });
    panels.forEach(p => {
      p.classList.toggle('tab-panel--active', p.id === 'panel-' + target.dataset.tab);
    });
    moveIndicator(target);
    // Persist selected tab
    try {
      localStorage.setItem(TAB_KEY, target.dataset.tab);
    } catch (e) {
      // ignore storage errors
    }
    // Refresh stats when switching to the stats tab
    if (target.dataset.tab === 'stats') refreshStats();
  }

  tabs.forEach(tab => tab.addEventListener('click', () => activateTab(tab)));

  function initIndicator() {
    const active = document.querySelector('.tab--active');
    if (active) moveIndicator(active);
  }
  window.addEventListener('resize', initIndicator);
  window.addEventListener('load', initIndicator);

  // Restore last selected tab, if any
  (function restoreTab() {
    let stored = null;
    try {
      stored = localStorage.getItem(TAB_KEY);
    } catch (e) {
      stored = null;
    }
    if (stored) {
      const tabToActivate = Array.from(tabs).find(t => t.dataset.tab === stored);
      if (tabToActivate) {
        activateTab(tabToActivate);
        return;
      }
    }
    // Fallback to default indicator position
    initIndicator();
  })();

  /* ═══════════════════════════════════════
     Current Date Label
     ═══════════════════════════════════════ */
  function updateCurrentDateLabel() {
    if (!currentDateEl) return;
    const todayDate = new Date();
    try {
      const formatter = new Intl.DateTimeFormat('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      currentDateEl.textContent = formatter.format(todayDate);
    } catch (e) {
      // Fallback: simple numeric format if Intl not available
      const y = todayDate.getFullYear();
      const m = String(todayDate.getMonth() + 1).padStart(2, '0');
      const d = String(todayDate.getDate()).padStart(2, '0');
      currentDateEl.textContent = `${d}-${m}-${y}`;
    }
  }

  /* ═══════════════════════════════════════
     Fard Prayers
     ═══════════════════════════════════════ */
  function updateFardBadge() {
    const count = FARD_PRAYERS.filter(p => today.fard[p]).length;
    fardBadge.textContent = count + ' / 5';
  }

  function initFard() {
    const items = fardList.querySelectorAll('.prayer-item');
    items.forEach(item => {
      const key = item.dataset.prayer;
      const cb  = item.querySelector('.prayer-check');

      // Restore state
      cb.checked = !!today.fard[key];
      item.classList.toggle('prayer-item--checked', cb.checked);

      cb.addEventListener('change', () => {
        today.fard[key] = cb.checked;
        item.classList.toggle('prayer-item--checked', cb.checked);
        updateFardBadge();
        saveToday(today);
      });
    });
    updateFardBadge();
  }

  /* ═══════════════════════════════════════
     Sunnah Ratibah
     ═══════════════════════════════════════ */
  function updateSunnahBadge() {
    let done = 0;
    SUNNAH_PRAYERS.forEach(sp => {
      if (today.sunnah[sp.id]) done += sp.rakaa;
    });
    sunnahBadge.textContent = done + ' / ' + SUNNAH_TOTAL + ' ركعة';
  }

  function initSunnah() {
    const items = sunnahList.querySelectorAll('.prayer-item');
    items.forEach(item => {
      const key = item.dataset.sunnah;
      const cb  = item.querySelector('.prayer-check');

      cb.checked = !!today.sunnah[key];
      item.classList.toggle('prayer-item--checked', cb.checked);

      cb.addEventListener('change', () => {
        today.sunnah[key] = cb.checked;
        item.classList.toggle('prayer-item--checked', cb.checked);
        updateSunnahBadge();
        saveToday(today);
      });
    });
    updateSunnahBadge();
  }

  /* ═══════════════════════════════════════
     Nawafil (Duha & Qiyam)
     ═══════════════════════════════════════ */
  function initNafl() {
    ['duha', 'qiyam'].forEach(id => {
      const input = document.getElementById(id + '-input');
      const step  = 2;
      const checkbox = document.getElementById(id + '-done');
      const plusBtn  = document.querySelector(`.rakaa-btn.rakaa-btn--plus[data-target="${id}"]`);
      const minusBtn = document.querySelector(`.rakaa-btn.rakaa-btn--minus[data-target="${id}"]`);

      // Helper to normalize rakaa value per prayer
      function normalizeRakaa(val) {
        let v = parseInt(val, 10) || 0;
        if (id === 'duha') {
          // Min 2, even only
          if (v < 2) v = 2;
          if (v % 2 !== 0) v += 1;
        } else {
          // Qiyam: min 1, odd only
          if (v < 1) v = 1;
          if (v % 2 === 0) v += 1;
        }
        return v;
      }

      // Restore from today.nafl
      const state = today.nafl[id] || { done: false, rakaa: id === 'duha' ? 2 : 1 };
      state.rakaa = normalizeRakaa(state.rakaa);
      today.nafl[id] = state;

      checkbox.checked = !!state.done;
      input.value = state.rakaa;

       // Make the custom checkbox box clickable (since the real input is visually hidden)
       const customBox = checkbox.nextElementSibling;
       if (customBox && customBox.classList.contains('prayer-check-box')) {
         customBox.style.cursor = 'pointer';
         customBox.addEventListener('click', () => {
           checkbox.checked = !checkbox.checked;
           checkbox.dispatchEvent(new Event('change'));
         });
       }

      function setDisabled(disabled) {
        input.disabled = disabled;
        if (plusBtn) plusBtn.disabled = disabled;
        if (minusBtn) minusBtn.disabled = disabled;
      }

      setDisabled(!checkbox.checked);

      // Checkbox toggle: performed / not performed
      checkbox.addEventListener('change', () => {
        state.done = checkbox.checked;
        today.nafl[id] = state;
        setDisabled(!checkbox.checked);
        saveToday(today);
      });

      // +/- buttons
      [plusBtn, minusBtn].forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', () => {
          if (!checkbox.checked) return;
          let val = parseInt(input.value, 10) || 0;
          if (btn === plusBtn) {
            val += step;
          } else {
            val -= step;
          }
          val = normalizeRakaa(val);
          input.value = val;
          state.rakaa = val;
          today.nafl[id] = state;
          saveToday(today);
        });
      });

      // Direct input
      input.addEventListener('change', () => {
        let val = normalizeRakaa(input.value);
        input.value = val;
        state.rakaa = val;
        today.nafl[id] = state;
        saveToday(today);
      });
    });
  }

  /* ═══════════════════════════════════════
     Optional Prayers
     ═══════════════════════════════════════ */
  function renderOptionalItem(key) {
    const def  = OPTIONAL_DEFS[key];
    const data = today.optional[key];
    if (!def || !data) return;

    const el = document.createElement('div');
    el.className = 'optional-prayer-item';
    el.dataset.optionalItem = key;

    // Special case: Taraweeh — checkbox only (no rakaa input)
    if (key === 'taraweeh') {
      el.innerHTML = `
        <input type="checkbox" class="prayer-check" id="opt-check-${key}" />
        <span class="prayer-check-box"></span>
        <span class="prayer-name">${def.name}</span>
        <button class="btn-remove-optional" aria-label="حذف">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      const cb = el.querySelector('.prayer-check');
      cb.checked = !!data.checked;
      el.classList.toggle('prayer-item--checked', cb.checked);

      cb.addEventListener('change', () => {
        today.optional[key].checked = cb.checked;
        el.classList.toggle('prayer-item--checked', cb.checked);
        saveToday(today);
      });

      const checkBox = el.querySelector('.prayer-check-box');
      checkBox.style.cursor = 'pointer';
      checkBox.addEventListener('click', () => {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      });

      el.querySelector('.btn-remove-optional').addEventListener('click', () => {
        delete today.optional[key];
        saveToday(today);
        el.remove();
        updateOptionalMenuVisibility();
      });
    } else {
      // Default optional prayer: checkbox + rakaa input
      el.innerHTML = `
        <input type="checkbox" class="prayer-check" id="opt-check-${key}" />
        <span class="prayer-check-box"></span>
        <span class="prayer-name">${def.name}</span>
        <div class="rakaa-input-wrap">
          <button class="rakaa-btn rakaa-btn--minus" aria-label="إنقاص">−</button>
          <input type="number" class="rakaa-input" value="${data.rakaa}" min="0" step="${def.step}" />
          <button class="rakaa-btn rakaa-btn--plus" aria-label="زيادة">+</button>
          <span class="rakaa-label">ركعة</span>
        </div>
        <button class="btn-remove-optional" aria-label="حذف">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      // Checkbox
      const cb = el.querySelector('.prayer-check');
      cb.checked = !!data.checked;
      el.classList.toggle('prayer-item--checked', cb.checked);

      cb.addEventListener('change', () => {
        today.optional[key].checked = cb.checked;
        el.classList.toggle('prayer-item--checked', cb.checked);
        saveToday(today);
      });

      // Custom checkbox click
      const checkBox = el.querySelector('.prayer-check-box');
      checkBox.style.cursor = 'pointer';
      checkBox.addEventListener('click', () => {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      });

      // Rakaa stepper
      const rakaaInput = el.querySelector('.rakaa-input');
      el.querySelector('.rakaa-btn--plus').addEventListener('click', () => {
        let v = parseInt(rakaaInput.value, 10) || 0;
        v += def.step;
        rakaaInput.value = v;
        today.optional[key].rakaa = v;
        saveToday(today);
      });
      el.querySelector('.rakaa-btn--minus').addEventListener('click', () => {
        let v = parseInt(rakaaInput.value, 10) || 0;
        v = Math.max(0, v - def.step);
        rakaaInput.value = v;
        today.optional[key].rakaa = v;
        saveToday(today);
      });
      rakaaInput.addEventListener('change', () => {
        let v = parseInt(rakaaInput.value, 10) || 0;
        if (v < 0) v = 0;
        v = Math.round(v / def.step) * def.step;
        rakaaInput.value = v;
        today.optional[key].rakaa = v;
        saveToday(today);
      });

      // Remove button
      el.querySelector('.btn-remove-optional').addEventListener('click', () => {
        delete today.optional[key];
        saveToday(today);
        el.remove();
        updateOptionalMenuVisibility();
      });
    }

    optionalList.appendChild(el);
  }

  function updateOptionalMenuVisibility() {
    const menuItems = optionalMenu.querySelectorAll('.optional-menu__item');
    let anyVisible = false;
    menuItems.forEach(mi => {
      const key = mi.dataset.optional;
      const alreadyAdded = !!today.optional[key];
      mi.classList.toggle('optional-menu__item--hidden', alreadyAdded);
      if (!alreadyAdded) anyVisible = true;
    });
    // Hide the add button entirely if all options are added
    document.getElementById('add-optional-wrap').style.display = anyVisible ? '' : 'none';
  }

  function initOptional() {
    // Render any previously saved optional prayers
    Object.keys(today.optional).forEach(key => renderOptionalItem(key));
    updateOptionalMenuVisibility();

    // Toggle menu
    btnAddOpt.addEventListener('click', (e) => {
      e.stopPropagation();
      optionalMenu.classList.toggle('optional-menu--open');
    });

    // Menu item clicks
    optionalMenu.querySelectorAll('.optional-menu__item').forEach(mi => {
      mi.addEventListener('click', () => {
        const key = mi.dataset.optional;
        if (today.optional[key]) return; // already added

        today.optional[key] = { checked: false, rakaa: 0 };
        saveToday(today);
        renderOptionalItem(key);
        updateOptionalMenuVisibility();
        optionalMenu.classList.remove('optional-menu--open');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#add-optional-wrap')) {
        optionalMenu.classList.remove('optional-menu--open');
      }
    });
  }

  /* ═══════════════════════════════════════
     Athkar — Detailed Morning / Evening
     ═══════════════════════════════════════ */
  function updateAthkarBadge() {
    const m = today.athkarMandatory;
    const count = (m.morning ? 1 : 0) + (m.evening ? 1 : 0);
    athkarBadge.textContent = count + ' / 2';
  }

  function initAthkarDetailed() {
    buildAdhkarSection('morning', MORNING_ADHKAR, today.athkarMorningCounts,
      document.getElementById('morning-adhkar-list'),
      document.getElementById('morning-progress'),
      document.getElementById('toggle-morning'));

    buildAdhkarSection('evening', EVENING_ADHKAR, today.athkarEveningCounts,
      document.getElementById('evening-adhkar-list'),
      document.getElementById('evening-progress'),
      document.getElementById('toggle-evening'));

    updateAthkarBadge();
  }

  function buildAdhkarSection(type, adhkarList, countsObj, listEl, progressEl, toggleBtn) {
    if (!listEl || !toggleBtn) return;

    function updateProgress() {
      let done = 0;
      adhkarList.forEach(d => {
        if ((countsObj[d.id] || 0) >= d.count) done++;
      });
      progressEl.textContent = done + ' / ' + adhkarList.length;
      const allDone = done === adhkarList.length;
      today.athkarMandatory[type] = allDone;
      toggleBtn.classList.toggle('adhkar-section-toggle--done', allDone);
      updateAthkarBadge();
    }

    adhkarList.forEach(dhikr => {
      if (!countsObj[dhikr.id]) countsObj[dhikr.id] = 0;
      const current = countsObj[dhikr.id];
      const isDone = current >= dhikr.count;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'adhkar-dhikr-card' + (isDone ? ' adhkar-dhikr-card--done' : '');

      card.innerHTML = `
        <span class="adhkar-dhikr-card__text">${dhikr.text}</span>
        <span class="adhkar-dhikr-card__counter">
          <span class="adhkar-dhikr-card__current">${current}</span>
          <span class="adhkar-dhikr-card__sep">/</span>
          <span class="adhkar-dhikr-card__total">${dhikr.count}</span>
        </span>
      `;

      const currentEl = card.querySelector('.adhkar-dhikr-card__current');

      card.addEventListener('click', () => {
        if (countsObj[dhikr.id] >= dhikr.count) return;
        countsObj[dhikr.id]++;
        currentEl.textContent = countsObj[dhikr.id];
        // Pulse animation
        currentEl.classList.remove('adhkar-dhikr-card__current--pop');
        void currentEl.offsetWidth;
        currentEl.classList.add('adhkar-dhikr-card__current--pop');
        if (countsObj[dhikr.id] >= dhikr.count) {
          card.classList.add('adhkar-dhikr-card--done');
        }
        saveToday(today);
        updateProgress();
      });

      listEl.appendChild(card);
    });

    // Toggle expand/collapse
    toggleBtn.addEventListener('click', () => {
      const open = listEl.classList.toggle('adhkar-section-body--open');
      toggleBtn.classList.toggle('adhkar-section-toggle--open', open);
    });

    updateProgress();
  }

  /* ═══════════════════════════════════════
     Athkar — Counters
     ═══════════════════════════════════════ */
  function initAthkarCounters() {
    const cards = athkarCountersEl.querySelectorAll('.counter-card');
    cards.forEach(card => {
      const key   = card.dataset.counter;
      const countEl = card.querySelector('.counter-card__count');

      // Restore
      const saved = today.athkarCounters[key] || 0;
      countEl.textContent = saved;

      // Click to increment
      card.addEventListener('click', (e) => {
        // Ignore if clicking the reset button
        if (e.target.closest('.counter-card__reset')) return;

        today.athkarCounters[key] = (today.athkarCounters[key] || 0) + 1;
        countEl.textContent = today.athkarCounters[key];
        saveToday(today);

        // Pop animation
        countEl.classList.remove('counter-card__count--pop');
        void countEl.offsetWidth; // force reflow
        countEl.classList.add('counter-card__count--pop');
      });

      // Add reset button
      const resetBtn = document.createElement('button');
      resetBtn.className = 'counter-card__reset';
      resetBtn.setAttribute('aria-label', 'إعادة تعيين');
      resetBtn.innerHTML = '✕';
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        today.athkarCounters[key] = 0;
        countEl.textContent = '0';
        saveToday(today);
      });
      card.appendChild(resetBtn);

      // Make the long athkar full-width
      if (key === 'la_ilaha_wahdah' || key === 'subhan_bihamdi') {
        card.classList.add('counter-card--wide');
      }
    });
  }

  /* ═══════════════════════════════════════
     Athkar — Optional
     ═══════════════════════════════════════ */
  function renderAthkarOptionalItem(key) {
    const def  = ATHKAR_OPTIONAL_DEFS[key];
    const data = today.athkarOptional[key];
    if (!def || !data) return;

    const el = document.createElement('div');
    el.className = 'optional-prayer-item' + (def.duaaText ? ' optional-prayer-item--has-duaa' : '');
    el.dataset.athkarOptionalItem = key;

    let duaaHtml = '';
    if (def.duaaText) {
      duaaHtml = `
        <button class="duaa-toggle-btn" type="button">عرض الدعاء</button>
        <div class="duaa-expand-text">${def.duaaText}</div>
      `;
    }

    el.innerHTML = `
      <div class="optional-prayer-item__row">
        <input type="checkbox" class="prayer-check" id="athkar-opt-check-${key}" />
        <span class="prayer-check-box"></span>
        <span class="prayer-name">${def.name}</span>
        <button class="btn-remove-optional" aria-label="حذف">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      ${duaaHtml}
    `;

    const cb = el.querySelector('.prayer-check');
    cb.checked = !!data.checked;
    el.classList.toggle('prayer-item--checked', cb.checked);

    cb.addEventListener('change', () => {
      today.athkarOptional[key].checked = cb.checked;
      el.classList.toggle('prayer-item--checked', cb.checked);
      saveToday(today);
    });

    const checkBox = el.querySelector('.prayer-check-box');
    checkBox.style.cursor = 'pointer';
    checkBox.addEventListener('click', () => {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });

    el.querySelector('.btn-remove-optional').addEventListener('click', () => {
      delete today.athkarOptional[key];
      saveToday(today);
      el.remove();
      updateAthkarOptMenuVisibility();
    });

    // Expand/collapse duaa text
    if (def.duaaText) {
      const toggleBtn = el.querySelector('.duaa-toggle-btn');
      const expandEl  = el.querySelector('.duaa-expand-text');
      toggleBtn.addEventListener('click', () => {
        const open = expandEl.classList.toggle('duaa-expand-text--open');
        toggleBtn.textContent = open ? 'إخفاء الدعاء' : 'عرض الدعاء';
      });
    }

    athkarOptList.appendChild(el);
  }

  function updateAthkarOptMenuVisibility() {
    const menuItems = athkarOptMenu.querySelectorAll('.optional-menu__item');
    let anyVisible = false;
    menuItems.forEach(mi => {
      const key = mi.dataset.athkarOptional;
      const alreadyAdded = !!today.athkarOptional[key];
      mi.classList.toggle('optional-menu__item--hidden', alreadyAdded);
      if (!alreadyAdded) anyVisible = true;
    });
    document.getElementById('add-athkar-optional-wrap').style.display = anyVisible ? '' : 'none';
  }

  function initAthkarOptional() {
    Object.keys(today.athkarOptional).forEach(key => renderAthkarOptionalItem(key));
    updateAthkarOptMenuVisibility();

    btnAddAthkarOpt.addEventListener('click', (e) => {
      e.stopPropagation();
      athkarOptMenu.classList.toggle('optional-menu--open');
    });

    athkarOptMenu.querySelectorAll('.optional-menu__item').forEach(mi => {
      mi.addEventListener('click', () => {
        const key = mi.dataset.athkarOptional;
        if (today.athkarOptional[key]) return;
        today.athkarOptional[key] = { checked: false };
        saveToday(today);
        renderAthkarOptionalItem(key);
        updateAthkarOptMenuVisibility();
        athkarOptMenu.classList.remove('optional-menu--open');
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#add-athkar-optional-wrap')) {
        athkarOptMenu.classList.remove('optional-menu--open');
      }
    });
  }

  /* ═══════════════════════════════════════
     Quran — Daily Pages
     ═══════════════════════════════════════ */
  function updateQuranUI() {
    const pages = today.quranPages || 0;
    quranBadge.textContent = pages + ' صفحة';
    const pct = Math.min(100, (pages / QURAN_TOTAL_PAGES) * 100);
    quranProgressBar.style.width = pct + '%';
    quranProgressText.textContent = pages + ' / ' + QURAN_TOTAL_PAGES + ' صفحة';
  }

  function initQuranPages() {
    quranPagesInput.value = today.quranPages || 0;
    updateQuranUI();

    document.getElementById('quran-pages-plus').addEventListener('click', () => {
      let v = parseFloat(quranPagesInput.value) || 0;
      v = Math.round((v + 0.5) * 10) / 10;
      if (v > QURAN_TOTAL_PAGES) v = QURAN_TOTAL_PAGES;
      quranPagesInput.value = v;
      today.quranPages = v;
      saveToday(today);
      updateQuranUI();
    });

    document.getElementById('quran-pages-minus').addEventListener('click', () => {
      let v = parseFloat(quranPagesInput.value) || 0;
      v = Math.round((v - 0.5) * 10) / 10;
      if (v < 0) v = 0;
      quranPagesInput.value = v;
      today.quranPages = v;
      saveToday(today);
      updateQuranUI();
    });

    quranPagesInput.addEventListener('change', () => {
      let v = parseFloat(quranPagesInput.value) || 0;
      if (v < 0) v = 0;
      if (v > QURAN_TOTAL_PAGES) v = QURAN_TOTAL_PAGES;
      v = Math.round(v * 10) / 10; // 1 decimal place
      quranPagesInput.value = v;
      today.quranPages = v;
      saveToday(today);
      updateQuranUI();
    });
  }

  /* ═══════════════════════════════════════
     Quran — Optional Items
     ═══════════════════════════════════════ */
  function renderQuranOptionalItem(key) {
    const def  = QURAN_OPTIONAL_DEFS[key];
    const data = today.quranOptional[key];
    if (!def || !data) return;

    const el = document.createElement('div');
    el.className = 'optional-prayer-item';
    el.dataset.quranOptionalItem = key;

    el.innerHTML = `
      <input type="checkbox" class="prayer-check" id="quran-opt-check-${key}" />
      <span class="prayer-check-box"></span>
      <span class="prayer-name">${def.name}</span>
      <button class="btn-remove-optional" aria-label="حذف">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    const cb = el.querySelector('.prayer-check');
    cb.checked = !!data.checked;
    el.classList.toggle('prayer-item--checked', cb.checked);

    cb.addEventListener('change', () => {
      today.quranOptional[key].checked = cb.checked;
      el.classList.toggle('prayer-item--checked', cb.checked);
      saveToday(today);
    });

    const checkBox = el.querySelector('.prayer-check-box');
    checkBox.style.cursor = 'pointer';
    checkBox.addEventListener('click', () => {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });

    el.querySelector('.btn-remove-optional').addEventListener('click', () => {
      delete today.quranOptional[key];
      saveToday(today);
      el.remove();
      updateQuranOptMenuVisibility();
    });

    quranOptList.appendChild(el);
  }

  function updateQuranOptMenuVisibility() {
    const menuItems = quranOptMenu.querySelectorAll('.optional-menu__item');
    let anyVisible = false;
    menuItems.forEach(mi => {
      const key = mi.dataset.quranOptional;
      const alreadyAdded = !!today.quranOptional[key];
      mi.classList.toggle('optional-menu__item--hidden', alreadyAdded);
      if (!alreadyAdded) anyVisible = true;
    });
    document.getElementById('add-quran-optional-wrap').style.display = anyVisible ? '' : 'none';
  }

  function initQuranOptional() {
    Object.keys(today.quranOptional).forEach(key => renderQuranOptionalItem(key));
    updateQuranOptMenuVisibility();

    btnAddQuranOpt.addEventListener('click', (e) => {
      e.stopPropagation();
      quranOptMenu.classList.toggle('optional-menu--open');
    });

    quranOptMenu.querySelectorAll('.optional-menu__item').forEach(mi => {
      mi.addEventListener('click', () => {
        const key = mi.dataset.quranOptional;
        if (today.quranOptional[key]) return;
        today.quranOptional[key] = { checked: false };
        saveToday(today);
        renderQuranOptionalItem(key);
        updateQuranOptMenuVisibility();
        quranOptMenu.classList.remove('optional-menu--open');
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#add-quran-optional-wrap')) {
        quranOptMenu.classList.remove('optional-menu--open');
      }
    });
  }

  /* ═══════════════════════════════════════
     Custom Duaa (أدعية خاصة)
     ═══════════════════════════════════════ */
  function initCustomDuaa() {
    const listEl     = document.getElementById('custom-duaa-list');
    const addBtn     = document.getElementById('btn-add-custom-duaa');
    const inputRow   = document.getElementById('custom-duaa-input-row');
    const inputEl    = document.getElementById('custom-duaa-input');
    const confirmBtn = document.getElementById('custom-duaa-confirm');
    if (!listEl || !addBtn) return;

    function renderDuaaItem(duaa) {
      const el = document.createElement('div');
      el.className = 'optional-prayer-item';
      el.dataset.customDuaaId = duaa.id;

      el.innerHTML = `
        <input type="checkbox" class="prayer-check" id="custom-duaa-${duaa.id}" />
        <span class="prayer-check-box"></span>
        <span class="prayer-name">${escapeHtml(duaa.name)}</span>
        <button class="btn-remove-optional" aria-label="حذف">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      const cb = el.querySelector('.prayer-check');
      cb.checked = !!duaa.checked;
      el.classList.toggle('prayer-item--checked', cb.checked);

      cb.addEventListener('change', () => {
        duaa.checked = cb.checked;
        el.classList.toggle('prayer-item--checked', cb.checked);
        saveToday(today);
      });

      const checkBox = el.querySelector('.prayer-check-box');
      checkBox.style.cursor = 'pointer';
      checkBox.addEventListener('click', () => {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      });

      el.querySelector('.btn-remove-optional').addEventListener('click', () => {
        today.customDuaa = today.customDuaa.filter(d => d.id !== duaa.id);
        saveToday(today);
        el.remove();
      });

      listEl.appendChild(el);
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function addDuaa(name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      const duaa = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: trimmed,
        checked: false,
      };
      today.customDuaa.push(duaa);
      saveToday(today);
      renderDuaaItem(duaa);
    }

    // Render existing
    today.customDuaa.forEach(d => renderDuaaItem(d));

    // Show/hide input row
    addBtn.addEventListener('click', () => {
      inputRow.style.display = inputRow.style.display === 'none' ? '' : 'none';
      if (inputRow.style.display !== 'none') {
        inputEl.value = '';
        inputEl.focus();
      }
    });

    // Confirm add
    confirmBtn.addEventListener('click', () => {
      addDuaa(inputEl.value);
      inputEl.value = '';
      inputEl.focus();
    });

    // Enter key to add
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDuaa(inputEl.value);
        inputEl.value = '';
      }
    });
  }

  /* ═══════════════════════════════════════
     Fasting (الصيام)
     ═══════════════════════════════════════ */
  function initFasting() {
    const listEl = document.getElementById('fasting-list');
    if (!listEl) return;

    // ── Ramadan fasting mode ──
    if (isRamadan) {
      listEl.innerHTML = '';

      // Main checkbox: صمت اليوم
      const mainLabel = document.createElement('label');
      mainLabel.className = 'prayer-item';
      mainLabel.innerHTML = `
        <input type="checkbox" class="prayer-check" id="ramadan-fasted" />
        <span class="prayer-check-box"></span>
        <span class="prayer-name">صمت اليوم</span>
      `;
      listEl.appendChild(mainLabel);

      // Excuse section (shown only when NOT fasted)
      const excuseWrap = document.createElement('div');
      excuseWrap.className = 'ramadan-excuse-wrap';
      excuseWrap.id = 'ramadan-excuse-wrap';
      excuseWrap.innerHTML = `
        <p class="ramadan-excuse-wrap__prompt">لم تصم اليوم:</p>
        <label class="ramadan-excuse-option">
          <input type="radio" name="ramadan-excuse" value="excused" class="ramadan-excuse-radio" />
          <span class="ramadan-excuse-option__dot"></span>
          <span class="ramadan-excuse-option__text">بعذر</span>
        </label>
        <label class="ramadan-excuse-option">
          <input type="radio" name="ramadan-excuse" value="noExcuse" class="ramadan-excuse-radio" />
          <span class="ramadan-excuse-option__dot"></span>
          <span class="ramadan-excuse-option__text">بغير عذر</span>
        </label>
      `;
      listEl.appendChild(excuseWrap);

      // DOM refs
      const fastedCb = document.getElementById('ramadan-fasted');
      const excuseRadios = excuseWrap.querySelectorAll('.ramadan-excuse-radio');

      // Restore state
      const rf = today.ramadanFasting;
      fastedCb.checked = !!rf.fasted;
      mainLabel.classList.toggle('prayer-item--checked', fastedCb.checked);
      excuseWrap.style.display = rf.fasted ? 'none' : '';
      if (rf.excused) excuseRadios[0].checked = true;
      if (rf.noExcuse) excuseRadios[1].checked = true;

      // Events
      fastedCb.addEventListener('change', () => {
        today.ramadanFasting.fasted = fastedCb.checked;
        mainLabel.classList.toggle('prayer-item--checked', fastedCb.checked);
        if (fastedCb.checked) {
          today.ramadanFasting.excused = false;
          today.ramadanFasting.noExcuse = false;
          excuseRadios.forEach(r => r.checked = false);
        }
        excuseWrap.style.display = fastedCb.checked ? 'none' : '';
        saveToday(today);
      });

      excuseRadios.forEach(radio => {
        radio.addEventListener('change', () => {
          today.ramadanFasting.excused = excuseRadios[0].checked;
          today.ramadanFasting.noExcuse = excuseRadios[1].checked;
          saveToday(today);
        });
      });

      return;
    }

    // ── Normal fasting mode ──
    const items = listEl.querySelectorAll('.prayer-item');
    const refs = {};

    items.forEach(item => {
      const key = item.dataset.fasting;
      const cb = item.querySelector('.prayer-check');
      refs[key] = { item, cb };

      cb.checked = !!today.fasting[key];
      item.classList.toggle('prayer-item--checked', cb.checked);

      cb.addEventListener('change', () => {
        today.fasting[key] = cb.checked;
        item.classList.toggle('prayer-item--checked', cb.checked);

        // Mutual exclusion: uncheck the other
        if (cb.checked) {
          const otherKey = key === 'today' ? 'dawud' : 'today';
          if (refs[otherKey]) {
            refs[otherKey].cb.checked = false;
            refs[otherKey].item.classList.remove('prayer-item--checked');
            today.fasting[otherKey] = false;
          }
        }
        saveToday(today);
      });
    });
  }

  /* ═══════════════════════════════════════
     Ramadan Taraweeh (permanent prayer)
     ═══════════════════════════════════════ */
  function initRamadanTaraweeh() {
    if (!isRamadan) return;

    // Hide Taraweeh from the optional prayers menu
    const taraweehMenuItem = document.querySelector('.optional-menu__item[data-optional="taraweeh"]');
    if (taraweehMenuItem) taraweehMenuItem.style.display = 'none';

    // Remove it from optional data if it was previously added
    if (today.optional.taraweeh) {
      delete today.optional.taraweeh;
      const existing = document.querySelector('[data-optional-item="taraweeh"]');
      if (existing) existing.remove();
      saveToday(today);
    }

    // Add permanent Taraweeh row in the prayer section
    const naflList = document.getElementById('nafl-list');
    if (!naflList) return;

    const row = document.createElement('label');
    row.className = 'prayer-item';
    row.id = 'ramadan-taraweeh-row';
    row.innerHTML = `
      <input type="checkbox" class="prayer-check" id="ramadan-taraweeh-check" />
      <span class="prayer-check-box"></span>
      <span class="prayer-icon-sm">🌙</span>
      <span class="prayer-name">صلاة التراويح</span>
    `;
    naflList.parentElement.insertAdjacentElement('afterend', createTaraweehGroup(row));

    const cb = row.querySelector('.prayer-check');
    cb.checked = !!today.ramadanTaraweeh;
    row.classList.toggle('prayer-item--checked', cb.checked);

    cb.addEventListener('change', () => {
      today.ramadanTaraweeh = cb.checked;
      row.classList.toggle('prayer-item--checked', cb.checked);
      saveToday(today);
    });
  }

  function createTaraweehGroup(rowEl) {
    const group = document.createElement('div');
    group.className = 'prayer-group';
    const title = document.createElement('h3');
    title.className = 'prayer-group__title';
    title.textContent = 'صلاة رمضان';
    const list = document.createElement('div');
    list.className = 'prayer-list';
    list.appendChild(rowEl);
    group.appendChild(title);
    group.appendChild(list);
    return group;
  }

  /* ═══════════════════════════════════════
     Initialise
     ═══════════════════════════════════════ */
  initFard();
  initSunnah();
  initNafl();
  initOptional();
  initAthkarDetailed();
  initAthkarCounters();
  initAthkarOptional();
  initCustomDuaa();
  initQuranPages();
  initQuranOptional();
  initFasting();
  initRamadanTaraweeh();

  /* ═══════════════════════════════════════
     Statistics
     ═══════════════════════════════════════ */
  const FARD_NAMES = {
    fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر',
    maghrib: 'المغرب', isha: 'العشاء',
  };

  const SUNNAH_NAMES = {
    before_fajr: '٢ ركعة قبل الفجر',
    before_dhuhr: '٤ ركعات قبل الظهر',
    after_dhuhr: '٢ ركعة بعد الظهر',
    after_maghrib: '٢ ركعة بعد المغرب',
    after_isha: '٢ ركعة بعد العشاء',
  };

  const COUNTER_NAMES = {
    subhanallah: 'سبحان الله',
    alhamdulillah: 'الحمدلله',
    la_ilaha: 'لا إله إلا الله',
    allahu_akbar: 'الله أكبر',
    la_hawla: 'لا حول ولا قوة إلا بالله',
    subhan_bihamdi: 'سبحان الله وبحمده',
    astaghfirullah: 'أستغفرالله وأتوب إليه',
    la_ilaha_wahdah: 'لا إله إلا الله وحده...',
    salat_ibrahimiya: 'الصلاة الابراهيمية',
  };

  function statItem(icon, text, value) {
    const iconClass = icon === 'done' ? 'stat-item__icon--done'
                    : icon === 'miss' ? 'stat-item__icon--miss'
                    : 'stat-item__icon--info';
    const iconChar = icon === 'done' ? '✓' : icon === 'miss' ? '✗' : '●';
    const valHtml = value !== undefined ? `<span class="stat-item__value">${value}</span>` : '';
    return `<li class="stat-item">
      <span class="stat-item__icon ${iconClass}">${iconChar}</span>
      <span class="stat-item__text">${text}</span>
      ${valHtml}
    </li>`;
  }

  function ratioHtml(num, den) {
    return `<span class="stat-ratio">${num}<span class="stat-ratio__slash">/</span>${den}</span>`;
  }

  function refreshStats() {
    today = loadToday(); // Refresh from localStorage
    refreshStatsSalah();
    refreshStatsAthkar();
    refreshStatsQuran();
    refreshStatsFasting();
  }

  /* ── Score Calculation ── */
  const CIRCUMFERENCE = 2 * Math.PI * 52; // ≈ 326.73

  function calculateScore() {
    const gauge     = document.querySelector('.score-gauge');
    const fillEl    = document.getElementById('score-gauge-fill');
    const numberEl  = document.getElementById('score-number');
    const messageEl = document.getElementById('score-message');
    const breakdownEl = document.getElementById('score-breakdown');

    // Gate: all 5 fard prayers must be done
    const fardDone = FARD_PRAYERS.filter(p => today.fard[p]).length;

    if (fardDone < 5) {
      // Score = 0
      numberEl.textContent = '0';
      fillEl.style.strokeDashoffset = CIRCUMFERENCE;
      gauge.className = 'score-gauge score-gauge--zero';
      messageEl.className = 'score-card__message score-card__message--warning';
      messageEl.textContent = '«العهد الذي بيننا وبينهم الصلاة، فمن تركها فقد كفر»';
      breakdownEl.innerHTML = '';
      return;
    }

    // Scoring weights (total = 100)
    const weights = {
      sunnah:   20,  // sunnah ratibah (proportional to 12 rakahs)
      duha:     10,  // any duha > 0
      qiyam:    10,  // any qiyam > 0
      quran:    20,  // proportional to target (1 page = full 20)
      morning:  10,  // morning athkar checked
      evening:  10,  // evening athkar checked
      counters: 20,  // proportional to how many distinct counters used
    };

    const scores = {};

    // Sunnah: proportional to 12 total rakahs
    let sunnahRakaa = 0;
    SUNNAH_PRAYERS.forEach(s => { if (today.sunnah[s.id]) sunnahRakaa += s.rakaa; });
    scores.sunnah = Math.round((sunnahRakaa / SUNNAH_TOTAL) * weights.sunnah);

    // Duha: binary
    scores.duha = (today.nafl.duha && today.nafl.duha.done) ? weights.duha : 0;

    // Qiyam: binary
    scores.qiyam = (today.nafl.qiyam && today.nafl.qiyam.done) ? weights.qiyam : 0;

    // Quran: proportional to 1 page (min), cap at weight
    const pages = today.quranPages || 0;
    scores.quran = Math.min(weights.quran, Math.round(pages * weights.quran)); // 1 page = full

    // Morning athkar: binary
    scores.morning = today.athkarMandatory.morning ? weights.morning : 0;

    // Evening athkar: binary
    scores.evening = today.athkarMandatory.evening ? weights.evening : 0;

    // Counters: proportional to how many of the 9 distinct counters have count > 0
    const totalCounters = COUNTER_KEYS.length; // 9
    const usedCounters = COUNTER_KEYS.filter(k => (today.athkarCounters[k] || 0) > 0).length;
    scores.counters = Math.round((usedCounters / totalCounters) * weights.counters);

    // Total
    let total = Object.values(scores).reduce((s, v) => s + v, 0);

    // ── Ramadan fasting override: بغير عذر → score = 0 ──
    let ramadanPenalty = false;
    if (isRamadan) {
      const rf = today.ramadanFasting || {};
      if (rf.noExcuse) {
        total = 0;
        ramadanPenalty = true;
      }
    }

    // Update gauge
    const offset = CIRCUMFERENCE - (total / 100) * CIRCUMFERENCE;
    fillEl.style.strokeDashoffset = offset;
    numberEl.textContent = Math.min(total, 99);

    // Color tier
    let tier = 'high';
    if (total === 0) tier = 'zero';
    else if (total < 40) tier = 'low';
    else if (total < 70) tier = 'mid';
    gauge.className = 'score-gauge score-gauge--' + tier;

    // Message
    messageEl.className = 'score-card__message';
    if (ramadanPenalty) {
      messageEl.className = 'score-card__message score-card__message--warning';
      messageEl.innerHTML = 'قَالَ الله تَعَالَى:<br>﴿يا أَيُّهَا الَّذينَ آمَنوا كُتِبَ عَلَيكُمُ الصِّيامُ كَما كُتِبَ عَلَى الَّذينَ مِن قَبلِكُم لَعَلَّكُم تَتَّقونَ﴾<br>[البقرة: ١٨٣]';
    } else if (total >= 90) messageEl.textContent = 'ما شاء الله! أداء ممتاز 🌟';
    else if (total >= 70) messageEl.textContent = 'أحسنت! استمر في التحسن 💪';
    else if (total >= 40) messageEl.textContent = 'لا بأس، يمكنك تحسين أدائك ☀️';
    else messageEl.textContent = 'حاول أن تزيد من عباداتك اليوم 🤲';

    // Breakdown pills
    const labels = {
      sunnah: 'السنن', duha: 'الضحى', qiyam: 'القيام',
      quran: 'القرآن', morning: 'أذكار ص', evening: 'أذكار م', counters: 'التسبيح',
    };
    let bHtml = '';
    for (const [key, pts] of Object.entries(scores)) {
      bHtml += `<span class="score-breakdown__item">${labels[key]} <span class="score-breakdown__pts">${pts}/${weights[key]}</span></span>`;
    }
    breakdownEl.innerHTML = bHtml;
  }

  /* ── Salah Stats ── */
  function refreshStatsSalah() {
    const list = document.getElementById('stat-salah-list');
    let html = '';

    // Fard ratio
    const fardDone = FARD_PRAYERS.filter(p => today.fard[p]).length;
    html += statItem('info', 'الصلوات المفروضة', ratioHtml(fardDone, 5));

    // Sunnah ratio
    let sunnahRakaa = 0;
    SUNNAH_PRAYERS.forEach(s => { if (today.sunnah[s.id]) sunnahRakaa += s.rakaa; });
    html += statItem('info', 'السنن الراتبة', ratioHtml(sunnahRakaa, SUNNAH_TOTAL));

    // Duha
    const duhaState = today.nafl.duha || { done: false, rakaa: 2 };
    if (duhaState.done) {
      html += statItem('done', 'قمتَ بأداء صلاة الضحى بـ ' + duhaState.rakaa + ' ركعة');
    } else {
      html += statItem('miss', 'لم تقم بأداء صلاة الضحى');
    }

    // Qiyam
    const qiyamState = today.nafl.qiyam || { done: false, rakaa: 1 };
    if (qiyamState.done) {
      html += statItem('done', 'قمتَ بأداء قيام الليل بـ ' + qiyamState.rakaa + ' ركعة');
    } else {
      html += statItem('miss', 'لم تقم بأداء قيام الليل');
    }

    // Optional prayers (only if added)
    Object.keys(today.optional).forEach(key => {
      const def  = OPTIONAL_DEFS[key];
      const item = today.optional[key];
      if (!def) return;
      if (key === 'taraweeh') {
        if (item.checked) {
          html += statItem('done', 'قمتَ بأداء صلاة التراويح');
        } else {
          html += statItem('miss', 'لم تقم بأداء صلاة التراويح');
        }
      } else {
        const rakaa = item.rakaa || 0;
        if (item.checked || rakaa > 0) {
          html += statItem('done', 'قمتَ بأداء صلاة ' + def.name + (rakaa > 0 ? ' ' + rakaa + ' ركعة' : ''));
        } else {
          html += statItem('miss', 'لم تقم بأداء صلاة ' + def.name);
        }
      }
    });

    // Ramadan Taraweeh (permanent during Ramadan)
    if (isRamadan) {
      html += today.ramadanTaraweeh
        ? statItem('done', 'قمتَ بأداء صلاة التراويح')
        : statItem('miss', 'لم تقم بأداء صلاة التراويح');
    }

    list.innerHTML = html;
  }

  /* ── Athkar Stats ── */
  function refreshStatsAthkar() {
    const list = document.getElementById('stat-athkar-list');
    let html = '';

    // Morning athkar
    const mTotal = MORNING_ADHKAR.length;
    const mDone = MORNING_ADHKAR.filter(d => (today.athkarMorningCounts[d.id] || 0) >= d.count).length;
    if (mDone === 0) {
      html += statItem('miss', 'لم تقرأ أذكار الصباح');
    } else if (mDone < mTotal) {
      html += statItem('info', 'قمت بقراءة بعض أذكار الصباح', mDone + ' / ' + mTotal);
    } else {
      html += statItem('done', 'أكملت أذكار الصباح');
    }

    // Evening athkar
    const eTotal = EVENING_ADHKAR.length;
    const eDone = EVENING_ADHKAR.filter(d => (today.athkarEveningCounts[d.id] || 0) >= d.count).length;
    if (eDone === 0) {
      html += statItem('miss', 'لم تقرأ أذكار المساء');
    } else if (eDone < eTotal) {
      html += statItem('info', 'قمت بقراءة بعض أذكار المساء', eDone + ' / ' + eTotal);
    } else {
      html += statItem('done', 'أكملت أذكار المساء');
    }

    // Counters (only show non-zero ones)
    COUNTER_KEYS.forEach(key => {
      const count = today.athkarCounters[key] || 0;
      if (count > 0) {
        html += statItem('info', COUNTER_NAMES[key], count);
      }
    });

    // Optional athkar: DO NOT appear in stats

    list.innerHTML = html;
  }

  /* ── Quran Stats ── */
  function refreshStatsQuran() {
    const list = document.getElementById('stat-quran-list');
    let html = '';

    // Daily pages
    const pages = today.quranPages || 0;
    if (pages > 0) {
      html += statItem('done', 'قرأت الورد اليومي ' + pages + ' من ' + QURAN_TOTAL_PAGES + ' صفحة');
    } else {
      html += statItem('miss', 'لم تقرأ الورد اليومي');
    }

    // Optional Quran items (only if enabled — INCLUDED in stats)
    Object.keys(today.quranOptional).forEach(key => {
      const def  = QURAN_OPTIONAL_DEFS[key];
      const item = today.quranOptional[key];
      if (!def) return;
      if (item.checked) {
        html += statItem('done', 'قرأت ' + def.name);
      } else {
        html += statItem('miss', 'لم تقرأ ' + def.name);
      }
    });

    list.innerHTML = html;
  }

  /* ── Fasting Stats ── */
  function refreshStatsFasting() {
    const list = document.getElementById('stat-fasting-list');
    let html = '';
    if (isRamadan) {
      const rf = today.ramadanFasting || {};
      if (rf.fasted) {
        html += statItem('done', 'صمت اليوم — رمضان');
      } else if (rf.excused) {
        html += statItem('info', 'لم تصم اليوم (بعذر)');
      } else if (rf.noExcuse) {
        html += statItem('miss', 'لم تصم اليوم (بغير عذر)');
      } else {
        html += statItem('miss', 'لم تحدد حالة الصيام');
      }
    } else {
      if (today.fasting.today) {
        html += statItem('done', 'صمت اليوم');
      } else if (today.fasting.dawud) {
        html += statItem('done', 'أنت ملتزم بصيام داود');
      } else {
        html += statItem('miss', 'لم تصم اليوم');
      }
    }
    list.innerHTML = html;
  }

  /* ═══════════════════════════════════════
     New Day Modal
     ═══════════════════════════════════════ */
  const overlay     = document.getElementById('modal-overlay');
  const btnNewDay   = document.getElementById('btn-new-day');
  const btnCancel   = document.getElementById('modal-cancel');
  const btnConfirm  = document.getElementById('modal-confirm');

  function openModal() {
    populateModalSummary();
    overlay.classList.add('modal-overlay--open');
    if (btnConfirm) {
      btnConfirm.focus();
    }
  }

  function closeModal() {
    overlay.classList.remove('modal-overlay--open');
    if (btnNewDay) {
      btnNewDay.focus();
    }
  }

  function populateModalSummary() {
    today = loadToday();
    const fillEl    = document.getElementById('modal-gauge-fill');
    const numberEl  = document.getElementById('modal-score-number');
    const msgEl     = document.getElementById('modal-score-msg');
    const summaryEl = document.getElementById('modal-summary');

    // ── Calculate score for modal gauge ──
    const fardDone = FARD_PRAYERS.filter(p => today.fard[p]).length;
    let total = 0;

    if (fardDone < 5) {
      numberEl.textContent = '0';
      fillEl.style.strokeDashoffset = CIRCUMFERENCE;
      msgEl.className = 'modal-score__msg modal-score__msg--warning';
      msgEl.textContent = '«العهد الذي بيننا وبينهم الصلاة، فمن تركها فقد كفر»';
    } else {
      let sunnahRakaa = 0;
      SUNNAH_PRAYERS.forEach(s => { if (today.sunnah[s.id]) sunnahRakaa += s.rakaa; });
      const scores = {
        sunnah:   Math.round((sunnahRakaa / SUNNAH_TOTAL) * 20),
        duha:     (today.nafl.duha || 0) > 0 ? 10 : 0,
        qiyam:    (today.nafl.qiyam || 0) > 0 ? 10 : 0,
        quran:    Math.min(20, Math.round((today.quranPages || 0) * 20)),
        morning:  today.athkarMandatory.morning ? 10 : 0,
        evening:  today.athkarMandatory.evening ? 10 : 0,
        counters: Math.round((COUNTER_KEYS.filter(k => (today.athkarCounters[k] || 0) > 0).length / COUNTER_KEYS.length) * 20),
      };
      total = Object.values(scores).reduce((s, v) => s + v, 0);

      // Ramadan fasting penalty
      let ramadanPenalty = false;
      if (isRamadan) {
        const rf = today.ramadanFasting || {};
        if (rf.noExcuse) {
          total = 0;
          ramadanPenalty = true;
        }
      }

      numberEl.textContent = Math.min(total, 99);
      fillEl.style.strokeDashoffset = CIRCUMFERENCE - (total / 100) * CIRCUMFERENCE;
      msgEl.className = 'modal-score__msg';
      if (ramadanPenalty) {
        msgEl.className = 'modal-score__msg modal-score__msg--warning';
        msgEl.innerHTML = 'قَالَ الله تَعَالَى:<br>﴿يا أَيُّهَا الَّذينَ آمَنوا كُتِبَ عَلَيكُمُ الصِّيامُ كَما كُتِبَ عَلَى الَّذينَ مِن قَبلِكُم لَعَلَّكُم تَتَّقونَ﴾<br>[البقرة: ١٨٣]';
      } else if (total >= 90) msgEl.textContent = 'ما شاء الله! أداء ممتاز 🌟';
      else if (total >= 70) msgEl.textContent = 'أحسنت! استمر في التحسن 💪';
      else if (total >= 40) msgEl.textContent = 'لا بأس، يمكنك تحسين أدائك ☀️';
      else msgEl.textContent = 'حاول أن تزيد من عباداتك اليوم 🤲';
    }

    // ── Build summary HTML ──
    let html = '';

    // Salah section
    let salahItems = '';
    salahItems += statItem('info', 'الصلوات المفروضة', ratioHtml(fardDone, 5));
    let sunnahR = 0;
    SUNNAH_PRAYERS.forEach(s => { if (today.sunnah[s.id]) sunnahR += s.rakaa; });
    salahItems += statItem('info', 'السنن الراتبة', ratioHtml(sunnahR, SUNNAH_TOTAL));
    const duhaState = today.nafl.duha || { done: false, rakaa: 2 };
    salahItems += duhaState.done
      ? statItem('done', 'صلاة الضحى بـ ' + duhaState.rakaa + ' ركعة')
      : statItem('miss', 'لم تصل الضحى');
    const qiyamState = today.nafl.qiyam || { done: false, rakaa: 1 };
    salahItems += qiyamState.done
      ? statItem('done', 'قيام الليل بـ ' + qiyamState.rakaa + ' ركعة')
      : statItem('miss', 'لم تصل القيام');
    Object.keys(today.optional).forEach(key => {
      const def = OPTIONAL_DEFS[key]; if (!def) return;
      const opt = today.optional[key];
      if (key === 'taraweeh') {
        salahItems += opt.checked
          ? statItem('done', 'صلاة التراويح')
          : statItem('miss', 'صلاة التراويح');
      } else {
        const r = opt.rakaa || 0;
        salahItems += (opt.checked || r > 0)
          ? statItem('done', def.name + (r > 0 ? ' ' + r + ' ركعة' : ''))
          : statItem('miss', def.name);
      }
    });
    // Ramadan Taraweeh (permanent)
    if (isRamadan) {
      salahItems += today.ramadanTaraweeh
        ? statItem('done', 'صلاة التراويح')
        : statItem('miss', 'لم تصل التراويح');
    }
    html += `<div class="modal-summary__section"><h4 class="modal-summary__title">متابعة الصلاة</h4><ul class="modal-summary__list">${salahItems}</ul></div>`;

    // Athkar section
    let athkarItems = '';
    const mTotalM = MORNING_ADHKAR.length;
    const mDoneM = MORNING_ADHKAR.filter(d => (today.athkarMorningCounts[d.id] || 0) >= d.count).length;
    if (mDoneM === 0) athkarItems += statItem('miss', 'أذكار الصباح');
    else if (mDoneM < mTotalM) athkarItems += statItem('info', 'أذكار الصباح', mDoneM + ' / ' + mTotalM);
    else athkarItems += statItem('done', 'أذكار الصباح');
    const eTotalM = EVENING_ADHKAR.length;
    const eDoneM = EVENING_ADHKAR.filter(d => (today.athkarEveningCounts[d.id] || 0) >= d.count).length;
    if (eDoneM === 0) athkarItems += statItem('miss', 'أذكار المساء');
    else if (eDoneM < eTotalM) athkarItems += statItem('info', 'أذكار المساء', eDoneM + ' / ' + eTotalM);
    else athkarItems += statItem('done', 'أذكار المساء');
    COUNTER_KEYS.forEach(key => {
      const c = today.athkarCounters[key] || 0;
      if (c > 0) athkarItems += statItem('info', COUNTER_NAMES[key], c);
    });
    html += `<div class="modal-summary__section"><h4 class="modal-summary__title">متابعة الأذكار</h4><ul class="modal-summary__list">${athkarItems}</ul></div>`;

    // Quran section
    let quranItems = '';
    const pages = today.quranPages || 0;
    quranItems += pages > 0
      ? statItem('done', 'الورد اليومي ' + pages + ' من ' + QURAN_TOTAL_PAGES + ' صفحة')
      : statItem('miss', 'لم تقرأ الورد اليومي');
    Object.keys(today.quranOptional).forEach(key => {
      const def = QURAN_OPTIONAL_DEFS[key]; if (!def) return;
      quranItems += today.quranOptional[key].checked
        ? statItem('done', def.name) : statItem('miss', def.name);
    });
    html += `<div class="modal-summary__section"><h4 class="modal-summary__title">متابعة القرآن</h4><ul class="modal-summary__list">${quranItems}</ul></div>`;

    summaryEl.innerHTML = html;
  }

  function resetDailyData() {
    // Preserve optional items structure but reset values
    const preserved = {
      optional: {},
      athkarOptional: {},
      quranOptional: {},
      customDuaa: [],
    };

    // Keep optional prayer keys but reset checked/rakaa
    Object.keys(today.optional).forEach(key => {
      preserved.optional[key] = { checked: false, rakaa: 0 };
    });

    // Keep optional athkar keys but reset checked
    Object.keys(today.athkarOptional).forEach(key => {
      preserved.athkarOptional[key] = { checked: false };
    });

    // Keep optional quran keys but reset checked
    Object.keys(today.quranOptional).forEach(key => {
      preserved.quranOptional[key] = { checked: false };
    });

    // Keep custom duaa names but reset checked
    (today.customDuaa || []).forEach(d => {
      preserved.customDuaa.push({ id: d.id, name: d.name, checked: false });
    });

    // Build fresh day with preserved optionals (nafl structure is recreated by getDefaultDay)
    const fresh = getDefaultDay();
    fresh.optional       = preserved.optional;
    fresh.athkarOptional = preserved.athkarOptional;
    fresh.quranOptional  = preserved.quranOptional;
    fresh.customDuaa     = preserved.customDuaa;

    today = fresh;
    saveToday(today);

    // Reload page to re-render all UI
    location.reload();
  }

  btnNewDay.addEventListener('click', openModal);
  btnCancel.addEventListener('click', closeModal);
  btnConfirm.addEventListener('click', () => {
    closeModal();
    setTimeout(resetDailyData, 300); // Wait for close animation
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('modal-overlay--open')) {
      closeModal();
    }
  });

  /* ═══════════════════════════════════════
     Hijri Date Dashboard
     ═══════════════════════════════════════ */
  function initHijriDashboard() {
    const dashboard   = document.getElementById('hijri-dashboard');
    const dayNameEl   = document.getElementById('hijri-day-name');
    const gregorianEl = document.getElementById('hijri-gregorian');
    const hijriEl     = document.getElementById('hijri-hijri');
    const messageEl   = document.getElementById('hijri-message');
    if (!dashboard) return;

    const now = new Date();

    // ── Day name in Arabic ──
    try {
      const dayFmt = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' });
      dayNameEl.textContent = dayFmt.format(now);
    } catch {
      dayNameEl.textContent = '';
    }

    // ── Gregorian date (ميلادي) ──
    try {
      const gregFmt = new Intl.DateTimeFormat('ar-EG', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      gregorianEl.textContent = gregFmt.format(now) + ' ميلادي';
    } catch {
      gregorianEl.textContent = '';
    }

    // ── Hijri date (هجري) ──
    let hijriMonth = 0;
    let hijriDay   = 0;
    if (TEST_HIJRI_DATE) {
      hijriMonth = TEST_HIJRI_DATE.month;
      hijriDay   = TEST_HIJRI_DATE.day;
      hijriEl.textContent = '(وضع الاختبار) شهر ' + hijriMonth + ' يوم ' + hijriDay;
    } else {
      try {
        const hijriFmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
          day: 'numeric', month: 'long', year: 'numeric',
        });
        hijriEl.textContent = hijriFmt.format(now) + ' هجري';

        // Extract numeric month and day for occasion detection
        const partsFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
          day: 'numeric', month: 'numeric', year: 'numeric',
        });
        const parts = partsFmt.formatToParts(now);
        parts.forEach(p => {
          if (p.type === 'month') hijriMonth = parseInt(p.value, 10);
          if (p.type === 'day')   hijriDay   = parseInt(p.value, 10);
        });
      } catch {
        hijriEl.textContent = '';
      }
    }

    // ── Determine occasion (priority order) ──
    let cssClass = '';
    let message  = '';

    if (hijriMonth === 9 && hijriDay >= 21) {
      // Last ten nights of Ramadan (العشر الأواخر)
      cssClass = 'hijri-dashboard--last-ten';
      message  = 'العشر الأواخر من رمضان 🌙';
    } else if (hijriMonth === 9) {
      // Ramadan
      cssClass = 'hijri-dashboard--ramadan';
      message  = 'رمضان مبارك 🌙';
    } else if (hijriMonth === 12 && hijriDay === 9) {
      // Yawm Arafah
      cssClass = 'hijri-dashboard--special';
      message  = 'اليوم يوم عرفة';
    } else if (hijriMonth === 1 && hijriDay === 10) {
      // Yawm Ashura
      cssClass = 'hijri-dashboard--special';
      message  = 'اليوم يوم عاشوراء';
    }

    // Apply style
    if (cssClass) {
      dashboard.classList.add(cssClass);
    }

    // Show message if present
    if (message) {
      messageEl.textContent = message;
      messageEl.classList.add('hijri-dashboard__message--visible');
    }
  }

  /* ═══════════════════════════════════════
     Prayer Times (مواقيت الصلاة)
     ═══════════════════════════════════════ */
  const PRAYER_TIMES_CACHE_KEY = 'suna-prayer-times';
  const REGION_KEY = 'suna-region';
  const DEFAULT_REGION = 'Riyadh';

  function initPrayerTimes() {
    const toggleBtn  = document.getElementById('toggle-prayer-times');
    const body       = document.getElementById('prayer-times-body');
    const banner     = document.getElementById('last-third-banner');
    const regionSel  = document.getElementById('region-select');
    if (!toggleBtn || !body) return;

    // Toggle expand / collapse
    toggleBtn.addEventListener('click', () => {
      const open = body.classList.toggle('prayer-times-body--open');
      toggleBtn.classList.toggle('prayer-times-toggle--open', open);
    });

    // ── Region selection ──
    let currentRegion = DEFAULT_REGION;
    try {
      const saved = localStorage.getItem(REGION_KEY);
      if (saved) currentRegion = saved;
    } catch { /* ignore */ }

    if (regionSel) {
      regionSel.value = currentRegion;
      regionSel.addEventListener('change', () => {
        currentRegion = regionSel.value;
        try { localStorage.setItem(REGION_KEY, currentRegion); } catch { /* ignore */ }
        // Clear cache and re-fetch for new region
        try { localStorage.removeItem(PRAYER_TIMES_CACHE_KEY); } catch { /* ignore */ }
        fetchPrayerTimes(todayKey(), currentRegion);
      });
    }

    // ── Load or fetch prayer times ──
    const todayStr = todayKey();
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(PRAYER_TIMES_CACHE_KEY));
    } catch { cached = null; }

    if (cached && cached.date === todayStr && cached.region === currentRegion && cached.timings) {
      applyPrayerTimes(cached.timings);
    } else {
      fetchPrayerTimes(todayStr, currentRegion);
    }

    function fetchPrayerTimes(dateStr, city) {
      const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=Saudi%20Arabia&method=4`;
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error('Network response was not ok');
          return res.json();
        })
        .then(json => {
          if (json.code === 200 && json.data && json.data.timings) {
            const timings = json.data.timings;
            // Cache for today + region
            try {
              localStorage.setItem(PRAYER_TIMES_CACHE_KEY, JSON.stringify({
                date: dateStr,
                region: city,
                timings: timings,
              }));
            } catch { /* ignore */ }
            applyPrayerTimes(timings);
          }
        })
        .catch(err => {
          console.warn('Prayer times fetch failed:', err);
        });
    }

    function applyPrayerTimes(timings) {
      // Strip "(EET)" or similar timezone suffixes from values
      const clean = t => (t || '').replace(/\s*\(.*\)/, '').trim();

      const fajrStr    = clean(timings.Fajr);
      const sunriseStr = clean(timings.Sunrise);
      const dhuhrStr   = clean(timings.Dhuhr);
      const asrStr     = clean(timings.Asr);
      const maghribStr = clean(timings.Maghrib);
      const ishaStr    = clean(timings.Isha);

      // Populate the 6 prayer time rows
      setText('pt-fajr',    fajrStr);
      setText('pt-sunrise', sunriseStr);
      setText('pt-dhuhr',   dhuhrStr);
      setText('pt-asr',     asrStr);
      setText('pt-maghrib', maghribStr);
      setText('pt-isha',    ishaStr);

      // ── Calculate Islamic midnight and last third ──
      const maghribMin = parseTimeToMinutes(maghribStr);
      const fajrMin    = parseTimeToMinutes(fajrStr);

      if (maghribMin !== null && fajrMin !== null) {
        // Night duration: Maghrib → Fajr (next day)
        let nightLen = fajrMin - maghribMin;
        if (nightLen <= 0) nightLen += 24 * 60; // crosses midnight

        // Islamic midnight = Maghrib + nightLen / 2
        const midnightMin   = (maghribMin + Math.floor(nightLen / 2)) % (24 * 60);
        // Last third start  = Maghrib + 2/3 * nightLen
        const lastThirdMin  = (maghribMin + Math.floor((2 * nightLen) / 3)) % (24 * 60);

        setText('pt-midnight',   minutesToTimeStr(midnightMin));
        setText('pt-last-third', minutesToTimeStr(lastThirdMin));

        // ── Hadith banner: show if now is within [lastThirdStart, Fajr) ──
        if (banner) {
          let nowMin;
          if (TEST_TIME) {
            const tp = TEST_TIME.split(':');
            nowMin = parseInt(tp[0], 10) * 60 + parseInt(tp[1], 10);
          } else {
            const now = new Date();
            nowMin = now.getHours() * 60 + now.getMinutes();
          }
          // Calculate the effective Fajr boundary (may be next day)
          let fajrEnd = fajrMin;
          if (fajrEnd <= maghribMin) fajrEnd += 24 * 60; // Fajr is next day

          let lastThirdStart = lastThirdMin;
          if (lastThirdStart <= maghribMin) lastThirdStart += 24 * 60;

          let nowNorm = nowMin;
          // If now is before Fajr in raw minutes but night crosses midnight,
          // we need to normalize
          if (nowNorm < maghribMin && fajrEnd > 24 * 60) {
            nowNorm += 24 * 60;
          }

          if (nowNorm >= lastThirdStart && nowNorm < fajrEnd) {
            banner.classList.add('last-third-banner--visible');
          }
        }
      }
    }

    function setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function parseTimeToMinutes(str) {
      if (!str) return null;
      const parts = str.split(':');
      if (parts.length < 2) return null;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    }

    function minutesToTimeStr(totalMin) {
      const m = ((totalMin % (24 * 60)) + (24 * 60)) % (24 * 60);
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      return hh + ':' + mm;
    }
  }

  // Initial date label setup
  updateCurrentDateLabel();
  initHijriDashboard();
  initPrayerTimes();

  /* ═══════════════════════════════════════
     Welcome Popup (first-time only)
     ═══════════════════════════════════════ */
  (function initWelcome() {
    if (localStorage.getItem('welcome_seen')) return;
    const overlay = document.getElementById('welcome-overlay');
    const closeBtn = document.getElementById('welcome-close');
    if (!overlay || !closeBtn) return;

    // Show after a brief delay for smoother entrance
    requestAnimationFrame(() => overlay.classList.add('welcome-overlay--open'));

    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('welcome-overlay--open');
      localStorage.setItem('welcome_seen', 'true');
    });
  })();

})();
