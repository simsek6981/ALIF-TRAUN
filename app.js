(function () {
  'use strict';
  const C = window.PrayerCore;
  const $ = id => document.getElementById(id);
  const CACHE_KEY = 'alif-traun-linz-v1';
  const REFRESH_MS = 15 * 60 * 1000;
  let rows = [];
  let inFlight = false;
  let displayedDate = '';
  let lastAttempt = 0;
  let lastTickDate = '';
  let lastHighlight = '';
  const dateFormatter = new Intl.DateTimeFormat('tr-TR', { timeZone: C.TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shortDateFormatter = new Intl.DateTimeFormat('de-AT', { timeZone: C.TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
  const hijriMonths = ['Muharrem', 'Safer', 'Rebi�levvel', 'Rebi�lahir', 'Cemaziyelevvel', 'Cemaziyelahir', 'Recep', 'Saban', 'Ramazan', 'Sevval', 'Zilkade', 'Zilhicce'];

  function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function storageSet(key, value) { try { localStorage.setItem(key, value); } catch { /* Display still works when storage is unavailable. */ } }
  function status(text, error = false) {
    $('data-status').textContent = text;
    $('data-status').classList.toggle('status-error', error);
  }
  function clockTime(date) { const p = C.parts(date); return `${p.hour}:${p.minute}`; }
  async function fetchJSON(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  function accept(data) {
    const validated = C.normalize(data);
    if (!validated.some(row => row.date === C.dateKey())) throw new Error('Today is missing from source data');
    rows = validated;
    displayedDate = '';
    render(new Date());
  }
  function render(now) {
    const today = C.dateKey(now);
    const row = rows.find(item => item.date === today);
    if (displayedDate !== today) {
      $('times').replaceChildren();
      C.PRAYERS.forEach(prayer => {
        const card = document.createElement('article');
        card.className = 'prayer-card';
        card.dataset.key = prayer.key;
        const name = document.createElement('h3');
        name.className = 'prayer-name';
        name.textContent = prayer.name;
        name.style.margin = '0';
        const de = document.createElement('p');
        de.className = 'prayer-de';
        de.lang = 'de';
        de.textContent = prayer.de;
        const time = document.createElement('time');
        time.className = 'prayer-time';
        time.textContent = row ? row[prayer.key] : '--:--';
        if (row) time.dateTime = new Date(C.epoch(today, row[prayer.key])).toISOString();
        const label = document.createElement('span');
        label.className = 'prayer-label';
        label.textContent = prayer.sunrise ? 'G�nes dogusu / Sonnenaufgang' : '';
        card.append(name, de, time, label);
        $('times').append(card);
      });
      $('times').setAttribute('aria-busy', 'false');
      $('miladi').textContent = dateFormatter.format(now);
      const h = row?.hDate?.split('-').map(Number);
      $('hicri').textContent = h && h[1] >= 1 && h[1] <= 12 && h[2] >= 1 && h[2] <= 30 ? `Hicri: ${h[2]} ${hijriMonths[h[1] - 1]} ${h[0]}` : '';
      renderCalendar(today);
      displayedDate = today;
      lastHighlight = '';
    }
    const next = row ? C.nextPrayer(rows, now) : null;
    const recent = row ? C.recentPrayer(rows, now) : null;
    $('next-name').textContent = recent ? `${recent.name} vakti baslad�` : next ? next.name : 'Vakitler bekleniyor';
    $('next-detail').textContent = next ? `${next.date === today ? 'Bug�n / Heute' : 'Yar�n / Morgen'} � ${next.time} � ${next.de}` : 'G�ncel vakitleri kaynaktan kontrol edin / Bitte Originalquelle pr�fen.';
    $('countdown').textContent = next ? C.countdown(next.at - now.getTime()) : '--:--:--';
    const highlight = `${next?.date}:${next?.key}:${recent?.key}`;
    if (highlight !== lastHighlight) {
      $('times').querySelectorAll('.prayer-card').forEach(card => {
        const active = Boolean(next && next.date === today && next.key === card.dataset.key);
        card.classList.toggle('next', active);
        if (active) card.setAttribute('aria-current', 'true'); else card.removeAttribute('aria-current');
        const prayer = C.PRAYERS.find(p => p.key === card.dataset.key);
        card.querySelector('.prayer-label').textContent = active ? 'Sonraki / Als N�chstes' : prayer.sunrise ? 'G�nes dogusu / Sonnenaufgang' : '';
      });
      lastHighlight = highlight;
    }
    $('times').querySelectorAll('.prayer-card').forEach(card => {
      card.classList.toggle('passed', Boolean(row && C.epoch(today, row[card.dataset.key]) <= now.getTime()));
    });
    const starts = rows.filter(r => r.date <= today).flatMap(r => C.PRAYERS.filter(p => !p.sunrise).map(p => C.epoch(r.date, r[p.key]))).filter(at => at <= now.getTime());
    const previous = starts.length ? Math.max(...starts) : null;
    const progress = next && previous !== null ? Math.min(100, Math.max(0, (now.getTime() - previous) / (next.at - previous) * 100)) : 0;
    $('progress-bar').style.width = `${progress}%`;
  }
  function renderCalendar(today) {
    const available = rows.filter(row => row.date >= today);
    $('calendar-body').replaceChildren();
    available.forEach(row => {
      const tr = document.createElement('tr');
      if (row.date === today) tr.className = 'today';
      const dateCell = document.createElement('th');
      dateCell.scope = 'row';
      dateCell.textContent = shortDateFormatter.format(new Date(`${row.date}T12:00:00Z`)) + (row.date === today ? ' � Bug�n / Heute' : '');
      tr.append(dateCell);
      C.PRAYERS.forEach(prayer => { const td = document.createElement('td'); td.textContent = row[prayer.key]; tr.append(td); });
      $('calendar-body').append(tr);
    });
    $('calendar-range').textContent = available.length ? `${shortDateFormatter.format(new Date(`${available[0].date}T12:00:00Z`))} - ${shortDateFormatter.format(new Date(`${available.at(-1).date}T12:00:00Z`))} � ${available.length} g�n / Tage` : 'G�ncel takvim bulunamad� / Kein aktueller Kalender verf�gbar.';
  }
  async function load() {
    if (inFlight) return;
    inFlight = true;
    lastAttempt = Date.now();
    $('refresh-button').disabled = true;
    status('Kaynak kontrol ediliyor / Quelle wird gepr�ft.');
    try {
      const data = await fetchJSON(C.API_URL);
      accept(data);
      storageSet(CACHE_KEY, JSON.stringify({ payload: data, checkedAt: new Date().toISOString() }));
      status(`Kaynak g�ncel � Son kontrol ${clockTime(new Date())} / Quelle aktualisiert � Linz`);
    } catch (error) {
      if (!rows.some(row => row.date === C.dateKey())) {
        try {
          const data = await fetchJSON('./data/linz.json');
          accept(data);
        } catch { /* Missing or expired snapshots never supply guessed prayer times. */ }
      }
      if (rows.some(row => row.date === C.dateKey())) {
        status('Kaynaga ulas�lamad�; kaydedilmis Linz vakitleri g�steriliyor. / Quelle nicht erreichbar; gespeicherte Linzer Zeiten werden angezeigt.', true);
      } else {
        rows = [];
        displayedDate = '';
        render(new Date());
        status('G�ncel vakitler y�klenemedi. Kaynak baglant�s�n� a��n veya yeniden deneyin. / Aktuelle Zeiten fehlen. Bitte Originalquelle �ffnen oder erneut versuchen.', true);
      }
      console.warn('Linz prayer time refresh failed:', error.message);
    } finally {
      inFlight = false;
      $('refresh-button').disabled = false;
    }
  }
  function tick() {
    const now = new Date();
    const p = C.parts(now);
    $('clock').replaceChildren(document.createTextNode(`${p.hour}:${p.minute}`));
    const seconds = document.createElement('span');
    seconds.className = 'seconds';
    seconds.textContent = `:${p.second}`;
    $('clock').append(seconds);
    const today = C.dateKey(now);
    if (today !== lastTickDate) {
      lastTickDate = today;
      displayedDate = '';
      if (lastAttempt) load();
    }
    render(now);
    if (Date.now() - lastAttempt >= REFRESH_MS) load();
  }
  const savedTheme = storageGet('alif-theme');
  let dark = savedTheme ? savedTheme === 'dark' : Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  function applyTheme() {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('theme-toggle').setAttribute('aria-pressed', String(dark));
  }
  applyTheme();
  $('theme-toggle').addEventListener('click', () => { dark = !dark; applyTheme(); storageSet('alif-theme', dark ? 'dark' : 'light'); });
  if (!document.fullscreenEnabled) $('fullscreen-toggle').hidden = true;
  $('fullscreen-toggle').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { status('Tam ekran kullan�lam�yor / Vollbild ist in diesem Browser nicht verf�gbar.', true); }
  });
  document.addEventListener('fullscreenchange', () => $('fullscreen-toggle').setAttribute('aria-pressed', String(Boolean(document.fullscreenElement))));
  $('refresh-button').addEventListener('click', load);
  window.addEventListener('online', load);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); if (Date.now() - lastAttempt > 60000) load(); } });
  try { const cached = JSON.parse(storageGet(CACHE_KEY)); if (cached?.payload) accept(cached.payload); } catch { /* Ignore corrupt or expired storage. */ }
  lastTickDate = C.dateKey();
  tick();
  load();
  setInterval(tick, 1000);
})();
