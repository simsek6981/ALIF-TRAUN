const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../prayer-core.js');
const snapshot = require('../data/linz.json');
const rows = C.normalize(snapshot);

test('all source times are kept exactly, without minute adjustments', () => {
  for (const original of snapshot.PrayerTimes) {
    const row = rows.find(r => r.date === original.date);
    for (const prayer of C.PRAYERS) assert.equal(row[prayer.key], original[prayer.key]);
  }
});
test('rejects another city, invalid times, duplicate dates and unordered times', () => {
  const invalidCity = structuredClone(snapshot); invalidCity.CityInfo.id = '1';
  assert.throws(() => C.normalize(invalidCity));
  for (const time of ['25:00', '05:90', '<b>05:30</b>', '5:30']) {
    const bad = structuredClone(snapshot); bad.PrayerTimes[0].imsak = time;
    assert.throws(() => C.normalize(bad));
  }
  const duplicates = structuredClone(snapshot); duplicates.PrayerTimes.push(duplicates.PrayerTimes[0]);
  assert.throws(() => C.normalize(duplicates));
  const reversed = structuredClone(snapshot); reversed.PrayerTimes[0].yatsi = '01:00';
  assert.throws(() => C.normalize(reversed));
});
test('Vienna dates are independent of browser/device timezone', () => {
  assert.equal(C.dateKey(new Date('2026-10-12T22:30:00Z')), '2026-10-13');
  assert.equal(C.epoch('2026-10-24', '05:51'), Date.parse('2026-10-24T03:51:00Z'));
  assert.equal(C.epoch('2026-10-25', '04:52'), Date.parse('2026-10-25T03:52:00Z'));
  assert.equal(C.epoch('2026-03-28', '05:00'), Date.parse('2026-03-28T04:00:00Z'));
  assert.equal(C.epoch('2026-03-29', '05:00'), Date.parse('2026-03-29T03:00:00Z'));
});
test('next prayer transitions immediately and sunrise is not a prayer', () => {
  const row = rows.find(r => r.date === '2026-10-12');
  assert.equal(C.nextPrayer(rows, new Date(C.epoch(row.date, '05:32'))).key, 'imsak');
  assert.equal(C.nextPrayer(rows, new Date(C.epoch(row.date, row.imsak))).key, 'ogle');
  assert.equal(C.recentPrayer(rows, new Date(C.epoch(row.date, row.imsak))).key, 'imsak');
  assert.equal(C.nextPrayer(rows, new Date(C.epoch(row.date, row.ikindi))).key, 'aksam');
});
test('after Isha, next countdown uses the actual next day Imsak', () => {
  const next = C.nextPrayer(rows, new Date(C.epoch('2026-10-12', '23:00')));
  assert.equal(next.date, '2026-10-13');
  assert.equal(next.time, '05:35');
  assert.equal(next.at, C.epoch('2026-10-13', '05:35'));
});
test('missing future times produce no invented countdown', () => {
  const todayOnly = rows.filter(r => r.date === '2026-10-12');
  assert.equal(C.nextPrayer(todayOnly, new Date(C.epoch('2026-10-12', '23:00'))), null);
  const missingTomorrow = rows.filter(r => r.date !== '2026-10-13');
  assert.equal(C.nextPrayer(missingTomorrow, new Date(C.epoch('2026-10-12', '23:00'))), null);
});
test('countdown never becomes negative', () => {
  assert.equal(C.countdown(-1000), '00:00:00');
  assert.equal(C.countdown(3661000), '01:01:01');
});
