const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const C = require('../prayer-core.js');
const snapshot = require('../data/linz.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const livePage = await browser.newPage({ timezoneId: 'America/New_York' });
  const errors = [];
  livePage.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') console.log('BROWSER CONSOLE', message.text()); });
  livePage.on('requestfailed', request => console.log('BROWSER REQUEST FAILED', request.url(), request.failure()?.errorText));
  livePage.on('response', response => { if (response.url().includes('nv-api')) console.log('BROWSER API RESPONSE', response.status(), response.headers()); });
  livePage.on('pageerror', error => errors.push(error.message));
  const probe = await fetch(C.API_URL, { headers: { Origin: 'https://simsek6981.github.io' } });
  console.log('API HTTP AND CORS', probe.status, probe.headers.get('access-control-allow-origin'));
  // This request is made by the browser from the site's origin: validates CORS too.
  const responsePromise = livePage.waitForResponse(response => response.url() === C.API_URL && response.ok(), { timeout: 30000 });
  await livePage.goto('http://127.0.0.1:8000');
  const livePayload = await (await responsePromise).json();
  const liveRows = C.normalize(livePayload);
  const today = liveRows.find(r => r.date === C.dateKey());
  assert.ok(today, 'Live source contains the current Austrian day');
  await livePage.waitForFunction(() => document.querySelector('#data-status').textContent.includes('Kaynak g�ncel'));
  assert.deepEqual(await livePage.locator('.prayer-time').allTextContents(), C.PRAYERS.map(p => today[p.key]));
  const displayedClock = await livePage.locator('#clock').innerText();
  const clockEpoch = C.epoch(today.date, displayedClock.slice(0, 5)) + Number(displayedClock.slice(-2)) * 1000;
  assert.ok(Math.abs(clockEpoch - Date.now()) < 2500, 'Clock displays Austrian time, with at most one tick of delay');
  console.log('LIVE CORS AND DEVICE TIMEZONE: PASS', today.date, C.PRAYERS.map(p => today[p.key]).join(' '));

  const original = await browser.newPage();
  const originalResponse = original.waitForResponse(response => response.url() === C.API_URL && response.ok(), { timeout: 30000 });
  await original.goto(C.SOURCE_URL, { waitUntil: 'domcontentloaded' });
  const originalPayload = await (await originalResponse).json();
  const originalToday = C.normalize(originalPayload).find(r => r.date === today.date);
  for (const p of C.PRAYERS) assert.equal(today[p.key], originalToday[p.key]);
  console.log('ORIGINAL WEBSITE COMPARISON: PASS (all six times identical)');
  await original.close();
  await livePage.close();

  const fixedInstant = '2026-10-12T13:30:00Z';
  fs.mkdirSync('test-results', { recursive: true });
  for (const [name, width, height] of [['desktop', 1920, 1080], ['mobile', 390, 844], ['small-mobile', 320, 700], ['portrait-tv', 1080, 1920]]) {
    const page = await browser.newPage({ viewport: { width, height }, timezoneId: 'America/New_York' });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(instant => {
      const NativeDate = Date;
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [instant])); }
        static now() { return new NativeDate(instant).getTime(); }
      };
    }, fixedInstant);
    await page.route(C.API_URL, route => route.fulfill({ json: snapshot }));
    await page.goto('http://127.0.0.1:8000');
    await page.waitForFunction(() => document.querySelector('#data-status').textContent.includes('Kaynak g�ncel'));
    assert.equal(await page.locator('#next-name').innerText(), 'Ikindi');
    assert.equal(await page.locator('#countdown').innerText(), '00:21:00');
    assert.equal(await page.locator('.prayer-card.next').count(), 1);
    assert.equal(await page.locator('.prayer-card.next .prayer-name').innerText(), 'Ikindi');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${name}: no page overflow`);
    const cards = await page.locator('.prayer-card').evaluateAll(items => items.map(el => {
      const card = el.getBoundingClientRect(); const time = el.querySelector('.prayer-time').getBoundingClientRect();
      return { card: { x: card.x, right: card.right }, time: { x: time.x, right: time.right } };
    }));
    for (const item of cards) assert.ok(item.time.x >= item.card.x && item.time.right <= item.card.right, `${name}: time fits card`);
    await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.screenshot({ path: `test-results/${name}-dark.png`, fullPage: true });
    await page.locator('#calendar summary').click();
    assert.ok(await page.locator('#calendar-body tr').count() >= 30);
    console.log('LAYOUT AND CONTROLS: PASS', name, width, height);
    if (name === 'desktop' || name === 'mobile') console.log(`SCREENSHOT_${name.toUpperCase()} ` + fs.readFileSync(`test-results/${name}.png`).toString('base64'));
    await page.close();
  }

  const fallback = await browser.newPage();
  await fallback.addInitScript(instant => {
    const NativeDate = Date;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [instant])); }
      static now() { return new NativeDate(instant).getTime(); }
    };
  }, fixedInstant);
  await fallback.route(C.API_URL, route => route.abort());
  await fallback.goto('http://127.0.0.1:8000');
  await fallback.waitForFunction(() => document.querySelector('#data-status').textContent.includes('kaydedilmis'));
  assert.equal(await fallback.locator('.prayer-time').first().innerText(), '05:33');
  console.log('SOURCE OUTAGE FALLBACK: PASS');
  await fallback.close();

  const expired = await browser.newPage();
  await expired.addInitScript(() => {
    const NativeDate = Date;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : ['2030-01-01T13:00:00Z'])); }
      static now() { return new NativeDate('2030-01-01T13:00:00Z').getTime(); }
    };
  });
  await expired.route(C.API_URL, route => route.abort());
  await expired.goto('http://127.0.0.1:8000');
  await expired.waitForFunction(() => document.querySelector('#data-status').textContent.includes('G�ncel vakitler y�klenemedi'));
  assert.deepEqual(await expired.locator('.prayer-time').allTextContents(), Array(6).fill('--:--'));
  assert.equal(await expired.locator('#countdown').innerText(), '--:--:--');
  console.log('EXPIRED DATA REJECTION: PASS');
  await expired.close();
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });