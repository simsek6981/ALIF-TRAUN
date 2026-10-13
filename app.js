(function () {
  'use strict';
  const C = window.PrayerCore;
  const $ = id => document.getElementById(id);
  const CACHE_KEY = 'alif-traun-linz-v1';
  const REFRESH_MS = 15 * 60 * 1000;
  const ui = {};
  ['times', 'miladi', 'hicri', 'clock-main', 'clock-seconds', 'clock', 'next-name', 'next-detail',
    'countdown-main', 'countdown-seconds', 'countdown', 'data-status', 'display-status',
    'refresh-button', 'calendar-panel', 'calendar-body', 'calendar-range'].forEach(id => { ui[id] = $(id); });
  let rows = [];
  let byDate = new Map();
  let day = '';
  let next = null;
  let todayEvents = [];
  let inFlight = false;
  let nextAttempt = 0;
  let lastAttempt = 0;
  let failures = 0;
  let sourceFailed = false;
  let calendarDirty = true;
  let lastFocus = null;
  let lastEmptyCheck = '';
  const cards = [];
  const dateFormatter = new Intl.DateTimeFormat('tr-TR', { timeZone: C.TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' });
  const shortDateFormatter = new Intl.DateTimeFormat('de-AT', { timeZone: C.TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
  const hijriMonths = ['Muharrem', 'Safer', 'Rebiülevvel', 'Rebiülahir', 'Cemaziyelevvel', 'Cemaziyelahir', 'Recep', 'Şaban', 'Ramazan', 'Şevval', 'Zilkade', 'Zilhicce'];

  function text(element, value) { if (element.textContent !== value) element.textContent = value; }
  function storageGet() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; } }
  function storageSet(data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ payload: data, checkedAt: new Date().toISOString() })); } catch { /* Storage is optional. */ } }
  function status(short, details, error) {
    text(ui['display-status'], short);
    text(ui['data-status'], details);
    ui['display-status'].classList.toggle('status-error', Boolean(error));
    ui['data-status'].classList.toggle('status-error', Boolean(error));
  }
  function hasToday() { return byDate.has(C.dateKey()); }
  function makeCards() {
    C.PRAYERS.forEach(prayer => {
      const card = document.createElement('article');
      card.className = 'prayer-card';
      card.dataset.key = prayer.key;
      const name = document.createElement('h2');
      name.className = 'prayer-name';
      name.textContent = prayer.name;
      const time = document.createElement('time');
      time.className = 'prayer-time';
      time.textContent = '--:--';
      card.append(name, time);
      ui.times.append(card);
      cards.push({ prayer, card, time });
    });
  }
  function setDay(now, date) {
    day = date;
    const row = byDate.get(day);
    text(ui.miladi, dateFormatter.format(now));
    todayEvents = [];
    cards.forEach(({ prayer, card, time }) => {
      text(time, row ? row[prayer.key] : '--:--');
      if (row) {
        const at = C.epoch(day, row[prayer.key]);
        time.dateTime = new Date(at).toISOString();
        if (!prayer.sunrise) todayEvents.push({ name: prayer.name, at });
      } else { time.removeAttribute('datetime'); }
      card.classList.remove('next');
      card.removeAttribute('aria-current');
    });
    const h = row && row.hDate ? row.hDate.split('-').map(Number) : null;
    text(ui.hicri, h && h[1] >= 1 && h[1] <= 12 && h[2] >= 1 && h[2] <= 30 ? 'Hicri: ' + h[2] + ' ' + hijriMonths[h[1] - 1] + ' ' + h[0] : '');
    next = row ? C.nextPrayer(rows, now) : null;
    calendarDirty = true;
    ui.times.setAttribute('aria-busy', 'false');
    if (!row && rows.length) status('Bugünün vakitleri bekleniyor', 'Bugüne ait doğrulanmış vakit yok. Kaynağı kontrol edin; eski günün saatleri gösterilmiyor.', true);
    else if (row && sourceFailed) status('Kaydedilmiş vakitler · ' + shortDateFormatter.format(now), 'Kaynağa ulaşılamadı. Yalnızca bugünün tarihine ait kayıtlı Linz vakitleri gösteriliyor.', true);
  }
  function accept(data) {
    const validated = C.normalize(data);
    if (!validated.some(row => row.date === C.dateKey())) throw new Error('Today missing from source');
    rows = validated;
    byDate = new Map(rows.map(row => [row.date, row]));
    setDay(new Date(), C.dateKey());
    tick();
  }
  function renderCalendar() {
    if (!calendarDirty) return;
    ui['calendar-body'].textContent = '';
    const available = rows.filter(row => row.date >= day);
    available.forEach(row => {
      const tr = document.createElement('tr');
      if (row.date === day) tr.className = 'today';
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = shortDateFormatter.format(new Date(row.date + 'T12:00:00Z')) + (row.date === day ? ' · Bugün' : '');
      tr.append(th);
      C.PRAYERS.forEach(prayer => { const td = document.createElement('td'); td.textContent = row[prayer.key]; tr.append(td); });
      ui['calendar-body'].append(tr);
    });
    text(ui['calendar-range'], available.length ? shortDateFormatter.format(new Date(available[0].date + 'T12:00:00Z')) + ' – ' + shortDateFormatter.format(new Date(available[available.length - 1].date + 'T12:00:00Z')) : 'Güncel takvim bulunamadı.');
    calendarDirty = false;
  }
  async function fetchJSON(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  async function load() {
    if (inFlight) return;
    inFlight = true;
    lastAttempt = Date.now();
    nextAttempt = lastAttempt + REFRESH_MS;
    ui['refresh-button'].disabled = true;
    if (!hasToday()) status('Vakitler yükleniyor…', 'Linz kaynağı kontrol ediliyor.', false);
    try {
      const data = await fetchJSON(C.DATA_URL);
      accept(data);
      storageSet(data);
      sourceFailed = false;
      failures = 0;
      const sourceCheck = new Date(data._alif && data._alif.fetchedAt ? data._alif.fetchedAt : '');
      const known = Number.isFinite(sourceCheck.getTime());
      const stale = !known || Date.now() - sourceCheck.getTime() > 6 * 60 * 60 * 1000;
      const p = known ? C.parts(sourceCheck) : null;
      const checked = known ? shortDateFormatter.format(sourceCheck) + ' ' + p.hour + ':' + p.minute : '—';
      status(stale ? 'Kaydedilmiş kaynak verisi' : '', 'Quellenstand / Kaynak kontrolü: ' + checked + '. Linz · Diyanet. Vakitler değişiklik yapılmadan alınır.', stale);
      nextAttempt = Date.now() + REFRESH_MS;
    } catch (error) {
      sourceFailed = true;
      if (!hasToday()) {
        try { accept(await fetchJSON('./data/linz.json')); } catch { /* Expired or invalid data is never displayed. */ }
      }
      if (hasToday()) {
        status('Kaydedilmiş vakitler · ' + shortDateFormatter.format(new Date()), 'Kaynağa ulaşılamadı; sadece bugünün tarihine ait kayıtlı vakitler gösteriliyor. Bağlantı otomatik tekrar denenecek.', true);
      } else {
        setDay(new Date(), C.dateKey());
        status('Bugünün vakitleri yüklenemedi', 'Güncel vakitler yüklenemedi. Kaynağı kontrol edin. Bağlantı otomatik tekrar denenecek.', true);
      }
      failures++;
      nextAttempt = Date.now() + Math.min(30000 * Math.pow(2, failures - 1), REFRESH_MS);
      console.warn('Linz prayer refresh failed:', error.message);
    } finally {
      inFlight = false;
      ui['refresh-button'].disabled = false;
      if (ui['calendar-panel'].hasAttribute('open')) renderCalendar();
    }
  }
  function tick() {
    const now = new Date();
    const p = C.parts(now);
    const date = p.year + '-' + p.month + '-' + p.day;
    text(ui['clock-main'], p.hour + ':' + p.minute);
    text(ui['clock-seconds'], ':' + p.second);
    if (date !== day) {
      const wasStarted = Boolean(day);
      setDay(now, date);
      if (wasStarted) nextAttempt = 0;
    }
    const minute = p.hour + ':' + p.minute;
    if (byDate.has(day) && ((!next && lastEmptyCheck !== minute) || (next && next.at <= now.getTime()))) {
      next = C.nextPrayer(rows, now);
      lastEmptyCheck = minute;
    }
    const recent = todayEvents.find(event => now.getTime() >= event.at && now.getTime() - event.at < 60000);
    text(ui['next-name'], next ? next.name : 'Vakitler bekleniyor');
    text(ui['next-detail'], next ? (next.date === day ? 'Bugün' : 'Yarın') + ' · ' + next.time + (recent ? ' · ' + recent.name + ' vakti başladı' : '') : 'Güncel kaynak kontrol ediliyor');
    const remaining = next ? C.countdown(next.at - now.getTime()) : '--:--:--';
    text(ui['countdown-main'], remaining.slice(0, 5));
    text(ui['countdown-seconds'], remaining.slice(5));
    cards.forEach(({ prayer, card }) => {
      const active = Boolean(next && next.date === day && next.key === prayer.key);
      if (card.classList.contains('next') !== active) {
        card.classList.toggle('next', active);
        if (active) card.setAttribute('aria-current', 'true'); else card.removeAttribute('aria-current');
      }
    });
    if (calendarDirty && ui['calendar-panel'].hasAttribute('open')) renderCalendar();
    if (Date.now() >= nextAttempt) load();
  }
  function openCalendar() {
    lastFocus = document.activeElement;
    renderCalendar();
    const dialog = ui['calendar-panel'];
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.dataset.fallback = 'true'; dialog.setAttribute('open', ''); }
    $('calendar-close').focus();
  }
  function closeCalendar() {
    const dialog = ui['calendar-panel'];
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }
  $('calendar-toggle').addEventListener('click', openCalendar);
  $('calendar-close').addEventListener('click', closeCalendar);
  ui['calendar-panel'].addEventListener('cancel', () => { if (lastFocus) lastFocus.focus(); });
  document.addEventListener('keydown', event => {
    const dialog = ui['calendar-panel'];
    if (!dialog.hasAttribute('open')) return;
    if (event.key === 'Escape' && dialog.dataset.fallback === 'true') { event.preventDefault(); closeCalendar(); }
    if (event.key === 'Tab' && dialog.dataset.fallback === 'true') {
      const focusable = Array.from(dialog.querySelectorAll('button:not(:disabled), a, [tabindex="0"]'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  const full = $('fullscreen-toggle');
  const enterFull = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
  if (!enterFull) full.hidden = true;
  full.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else { await enterFull.call(document.documentElement); }
      fullChanged();
    } catch { status('Tam ekran bu tarayıcıda açılamadı', 'Tarayıcının tam ekran seçeneğini kullanın.', true); }
  });
  function fullChanged() { full.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement || document.webkitFullscreenElement))); }
  document.addEventListener('fullscreenchange', fullChanged);
  document.addEventListener('webkitfullscreenchange', fullChanged);
  ui['refresh-button'].addEventListener('click', load);
  window.addEventListener('online', load);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); if (Date.now() - lastAttempt > 60000) load(); } });
  makeCards();
  const cached = storageGet();
  try { if (cached && cached.payload) accept(cached.payload); } catch { /* Ignore corrupt or expired cache. */ }
  tick();
  setInterval(tick, 1000);
})();
