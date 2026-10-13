const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const C = require('../prayer-core.js');
const snapshot = require('../data/linz.json');
snapshot._alif = { fetchedAt: '2026-10-12T13:30:00Z' };
const fixtures = C.normalize(snapshot);
const fixed = '2026-10-12T13:30:00Z';
const base = 'http://127.0.0.1:8000';
const errors = [];
function watch(page) { page.on('pageerror', error => errors.push(error.message)); }
async function freeze(page, instant = fixed) {
  await page.addInitScript(value => {
    const NativeDate = Date;
    window.__displayNow = new NativeDate(value).getTime();
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [window.__displayNow])); }
      static now() { return window.__displayNow; }
    };
    // A previously saved preference must have no effect in this light-only display.
    localStorage.setItem('alif-theme', 'dark');
  }, instant);
}
async function move(page, instant) {
  await page.evaluate(value => { window.__displayNow = new Date(value).getTime(); }, instant);
  await page.waitForTimeout(1100);
}
async function ready(page) {
  await page.waitForFunction(() => document.querySelector('#data-status').textContent.includes('Quellenstand'));
}
async function verifyGeometry(page, width, height, label) {
  const metrics = await page.evaluate(() => {
    function rect(el) { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; }
    return {
      viewport: [innerWidth, innerHeight],
      document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      logo: rect(document.querySelector('.brand-logo')),
      clockFont: parseFloat(getComputedStyle(document.querySelector('#clock')).fontSize),
      countdownFont: parseFloat(getComputedStyle(document.querySelector('#countdown')).fontSize),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      rows: Array.from(document.querySelectorAll('.prayer-card')).map(card => {
        const time = card.querySelector('.prayer-time'), name = card.querySelector('.prayer-name');
        const range = document.createRange(); range.selectNodeContents(time);
        return { card: rect(card), time: rect(time), name: rect(name), inkWidth: range.getBoundingClientRect().width,
          font: parseFloat(getComputedStyle(time).fontSize), color: getComputedStyle(time).color };
      })
    };
  });
  assert.ok(metrics.document[0] <= width + 1 && metrics.document[1] <= height + 1, label + ': no scrolling');
  assert.equal(metrics.rows.length, 6);
  assert.equal(metrics.bodyBackground, 'rgb(255, 255, 255)');
  for (let i = 0; i < 6; i++) {
    const r = metrics.rows[i];
    assert.ok(r.card.y >= 0 && r.card.bottom <= height, label + ': each row is on screen');
    assert.ok(r.time.y >= r.card.y - 1 && r.time.bottom <= r.card.bottom + 1, label + ': time fits vertically');
    assert.ok(r.time.x >= r.name.right && r.time.right <= width, label + ': columns do not overlap');
    assert.ok(r.inkWidth <= r.time.width + 1, label + ': digits fit horizontally');
    assert.equal(r.color, 'rgb(11, 24, 42)', label + ': all six times stay equally dark');
    if (i) assert.ok(metrics.rows[i - 1].card.bottom <= r.card.y + 1, label + ': rows do not overlap');
  }
  assert.ok(Math.abs(metrics.logo.width / metrics.logo.height - 5) < .05, label + ': logo is undistorted');
  if (width === 1080 && height === 1920) {
    assert.ok(metrics.rows.every(r => r.font >= 200), '1080 portrait: numbers are at least 200 px');
    assert.ok(metrics.logo.width >= 460, 'Original logo is prominently displayed');
    assert.ok(metrics.rows[0].font > metrics.clockFont * 2.5);
    assert.ok(metrics.rows[0].font > metrics.countdownFont * 2);
  }
  console.log('DISPLAY_METRICS', label, JSON.stringify(metrics));
  return metrics;
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const live = await browser.newPage({ timezoneId: 'America/New_York' });
  watch(live);
  const responsePromise = live.waitForResponse(response => response.url() === C.DATA_URL && response.ok(), { timeout: 30000 });
  await live.goto(base);
  const livePayload = await (await responsePromise).json();
  await ready(live);
  const today = C.normalize(livePayload).find(r => r.date === C.dateKey());
  assert.ok(today);
  assert.deepEqual(await live.locator('.prayer-time').allTextContents(), C.PRAYERS.map(p => today[p.key]));
  const displayedClock = await live.locator('#clock').innerText();
  assert.ok(Math.abs(C.epoch(today.date, displayedClock.slice(0, 5)) + Number(displayedClock.slice(-2)) * 1000 - Date.now()) < 2500);
  const upstream = await fetch(C.API_URL, { signal: AbortSignal.timeout(30000) });
  const sourceToday = C.normalize(await upstream.json()).find(r => r.date === today.date);
  C.PRAYERS.forEach(p => assert.equal(today[p.key], sourceToday[p.key]));
  console.log('LIVE SOURCE AND AUSTRIAN TIME: PASS', today.date);
  await live.close();
  fs.mkdirSync('test-results', { recursive: true });
  for (const [name, width, height] of [
    ['portrait-1080', 1080, 1920], ['portrait-720', 720, 1280], ['portrait-2160', 2160, 3840],
    ['portrait-768', 768, 1366], ['landscape-1920', 1920, 1080],
    ['mobile', 390, 844], ['small-mobile', 320, 700], ['short-landscape', 844, 390]
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, timezoneId: 'America/New_York', colorScheme: 'dark' });
    watch(page); await freeze(page);
    await page.route(C.DATA_URL, route => route.fulfill({ json: snapshot }));
    await page.goto(base); await ready(page);
    assert.equal(await page.locator('#next-name').innerText(), 'İkindi');
    assert.equal(await page.locator('#countdown').innerText(), '00:21:00');
    assert.equal(await page.locator('[id*="theme-toggle"]').count(), 0);
    assert.equal(await page.locator('.prayer-card.next').count(), 1);
    await verifyGeometry(page, width, height, name);
    await page.screenshot({ path: 'test-results/' + name + '.png', fullPage: false });
    await page.locator('#calendar-toggle').click();
    assert.ok(await page.locator('#calendar-panel').isVisible());
    assert.ok(await page.locator('#calendar-body tr').count() >= 30);
    await page.locator('#calendar-close').click();
    assert.equal(await page.locator('#calendar-panel').isVisible(), false);
    if (name === 'portrait-1080') {
      await page.locator('#fullscreen-toggle').click();
      await page.waitForFunction(() => Boolean(document.fullscreenElement));
      assert.equal(await page.locator('#fullscreen-toggle').getAttribute('aria-pressed'), 'true');
      await page.locator('#fullscreen-toggle').click();
      await page.waitForFunction(() => !document.fullscreenElement);
      await page.locator('#calendar-toggle').click();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#calendar-panel').isVisible(), false);
      console.log('FULLSCREEN AND ESCAPE: PASS');
    }
    await verifyGeometry(page, width, height, name + '-calendar-closed');
    console.log('LAYOUT, LIGHT-ONLY AND CALENDAR: PASS', name);
    await page.close();
  }
  const day = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  watch(day); await freeze(day);
  await day.route(C.DATA_URL, route => route.fulfill({ json: snapshot }));
  await day.goto(base); await ready(day);
  await day.evaluate(() => {
    window.__digitMutations = 0;
    const observer = new MutationObserver(records => { window.__digitMutations += records.length; });
    observer.observe(document.querySelector('#times'), { childList: true, subtree: true });
  });
  await day.waitForTimeout(2200);
  assert.equal(await day.evaluate(() => window.__digitMutations), 0, 'Unchanged times are not rebuilt every second');
  await move(day, '2026-10-12T13:51:00Z');
  assert.equal(await day.locator('#next-name').innerText(), 'Akşam');
  assert.equal(await day.locator('.prayer-card.next .prayer-name').innerText(), 'Akşam');
  await move(day, '2026-10-12T21:00:00Z');
  assert.equal(await day.locator('#next-name').innerText(), 'İmsak');
  assert.ok((await day.locator('#next-detail').innerText()).includes('Yarın'));
  assert.equal(await day.locator('.prayer-card.next').count(), 0);
  await move(day, '2026-10-12T22:00:01Z');
  const tomorrow = fixtures.find(r => r.date === '2026-10-13');
  assert.deepEqual(await day.locator('.prayer-time').allTextContents(), C.PRAYERS.map(p => tomorrow[p.key]));
  assert.ok((await day.locator('#miladi').innerText()).startsWith('13'));
  await verifyGeometry(day, 1080, 1920, 'after-midnight');
  console.log('STABLE DOM, PRAYER BOUNDARY AND MIDNIGHT: PASS');
  await day.close();

  const offline = await browser.newPage();
  watch(offline); await freeze(offline);
  let calls = 0;
  await offline.route(C.DATA_URL, route => { calls++; return calls === 1 ? route.abort() : route.fulfill({ json: snapshot }); });
  await offline.goto(base);
  await offline.waitForFunction(() => document.querySelector('#display-status').textContent.includes('Kaydedilmiş'));
  assert.equal(await offline.locator('.prayer-time').first().innerText(), '05:33');
  await move(offline, '2026-10-12T13:30:31Z');
  await ready(offline);
  assert.ok(calls >= 2, 'Automatic retry recovered without a reload');
  assert.equal(await offline.locator('#display-status').innerText(), '');
  console.log('OFFLINE CACHE AND AUTOMATIC RECOVERY: PASS');
  await offline.close();

  const expired = await browser.newPage();
  watch(expired); await freeze(expired, '2030-01-01T13:00:00Z');
  await expired.route(C.DATA_URL, route => route.abort());
  await expired.goto(base);
  await expired.waitForFunction(() => document.querySelector('#display-status').textContent.includes('yüklenemedi'));
  assert.deepEqual(await expired.locator('.prayer-time').allTextContents(), Array(6).fill('--:--'));
  assert.equal(await expired.locator('#countdown').innerText(), '--:--:--');
  console.log('EXPIRED DATA REJECTION: PASS');
  await expired.close();
  assert.deepEqual(errors, [], 'No uncaught app errors');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
