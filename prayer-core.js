(function (root) {
  'use strict';
  const TIME_ZONE = 'Europe/Vienna';
  const SOURCE_URL = 'https://namazvakitleri.com.tr/sehir/1480/linz-namaz-vakitleri';
  const API_URL = 'https://nv-api.com/getTimes/1480';
  const PRAYERS = [
    { key: 'imsak', name: 'Imsak', de: 'Morgend�mmerung' },
    { key: 'gunes', name: 'G�nes', de: 'Sonnenaufgang', sunrise: true },
    { key: 'ogle', name: '�gle', de: 'Mittagsgebet' },
    { key: 'ikindi', name: 'Ikindi', de: 'Nachmittagsgebet' },
    { key: 'aksam', name: 'Aksam', de: 'Abendgebet' },
    { key: 'yatsi', name: 'Yats�', de: 'Nachtgebet' }
  ];
  const partsFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  function parts(date = new Date()) {
    return Object.fromEntries(partsFormatter.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  }
  function dateKey(date = new Date()) {
    const p = parts(date);
    return `${p.year}-${p.month}-${p.day}`;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function normalize(payload) {
    if (!payload || String(payload.CityInfo?.id) !== '1480' || payload.Info?.Status !== 'Success' || !Array.isArray(payload.PrayerTimes) || !payload.PrayerTimes.length) {
      throw new Error('Invalid Linz prayer time response');
    }
    const seen = new Set();
    const rows = payload.PrayerTimes.map(row => {
      if (!validDate(row.date) || seen.has(row.date)) throw new Error('Invalid or duplicate calendar date');
      seen.add(row.date);
      const result = { date: row.date, hDate: typeof row.hDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.hDate) ? row.hDate : null };
      let previous = -1;
      for (const prayer of PRAYERS) {
        const time = row[prayer.key];
        if (typeof time !== 'string' || !timePattern.test(time)) throw new Error(`Invalid time: ${prayer.key}`);
        const [h, m] = time.split(':').map(Number);
        const minute = h * 60 + m;
        if (minute <= previous) throw new Error('Prayer times are not in chronological order');
        previous = minute;
        result[prayer.key] = time;
      }
      return result;
    });
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }
  // Convert source wall-clock times in Austria, regardless of the display device's zone.
  // Resolve the UTC offset for each date separately so DST changes are respected.
  function epoch(date, time) {
    if (!validDate(date) || !timePattern.test(time)) throw new Error('Invalid prayer date/time');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const wall = Date.UTC(year, month - 1, day, hour, minute);
    let guess = wall;
    for (let i = 0; i < 3; i++) {
      const p = parts(new Date(guess));
      const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
      guess += wall - represented;
    }
    return guess;
  }
  function nextPrayer(rows, now = new Date()) {
    const today = dateKey(now);
    const tomorrow = new Date(`${today}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowKey = tomorrow.toISOString().slice(0, 10);
    // Sunrise is displayed, but is not one of the five prayer start times.
    for (const row of rows) {
      if (row.date < today || row.date > tomorrowKey) continue;
      for (const prayer of PRAYERS) {
        if (prayer.sunrise) continue;
        const at = epoch(row.date, row[prayer.key]);
        if (at > now.getTime()) return { ...prayer, date: row.date, time: row[prayer.key], at };
      }
    }
    return null;
  }
  function recentPrayer(rows, now = new Date(), seconds = 60) {
    const row = rows.find(r => r.date === dateKey(now));
    if (!row) return null;
    for (const prayer of PRAYERS) {
      if (prayer.sunrise) continue;
      const elapsed = now.getTime() - epoch(row.date, row[prayer.key]);
      if (elapsed >= 0 && elapsed < seconds * 1000) return prayer;
    }
    return null;
  }
  function countdown(milliseconds) {
    const total = Math.max(0, Math.ceil(milliseconds / 1000));
    return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map(v => String(v).padStart(2, '0')).join(':');
  }
  const api = { TIME_ZONE, SOURCE_URL, API_URL, PRAYERS, parts, dateKey, normalize, epoch, nextPrayer, recentPrayer, countdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PrayerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
