const { chromium } = require('playwright');
const dir = require('path').join(__dirname, '..') + '/';
let fails = 0;
const ok = (n, c, x) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' :: ' + x : '')); };

const MOCK = `
window.__saved = null; window.__asked = 0; window.__answer = 'Of 600 claims, 56 were denied.';
window.claude = { use: async (n) => {
  if (n === 'downloads') return { save: async (r) => { window.__saved = r; return {status:'saved'}; } };
  if (n === 'sample') { const f = async (p) => { window.__asked++; window.__prompt = p; return {text: window.__answer, truncated:false}; }; return f; }
  return null; } };`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // ---------- Run A: no claude runtime (plain page) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.goto('file://' + dir + 'app/index.html');
    await page.waitForTimeout(500);
    const kpis = await page.locator('#kpiRow').innerText();
    ok('A: 600 claims in view', /600/.test(kpis), kpis.replace(/\n/g, ' | '));
    ok('A: denial rate 9.3%', /9\.3%/.test(kpis));
    ok('A: billed/paid/avg days match independent recomputation', /\$163,420\.63/.test(kpis) && /\$90,820\.18/.test(kpis) && /23\.3/.test(kpis), kpis.replace(/\n/g, ' | '));
    ok('A: summary dropdown starts collapsed', (await page.locator('#sumBox').getAttribute('open')) === null && !(await page.locator('#sumText').isVisible()));
    await page.locator('#sumBox > summary').click();
    ok('A: clicking Pattern summary opens it', await page.locator('#sumText').isVisible());
    ok('A: status mix in summary matches data (56 denied, 50 partial)', /56 denied \(9\.3%\) and 50 partially paid/.test(await page.locator('#sumText').innerText()));
    ok('A: scope statement visible (does not decide or advise)', /does not decide, recommend or predict/.test(await page.locator('body').innerText()));
    const monthLabels = await page.$$eval('#trendSvg text.axis-label', els => els.map(e => e.textContent));
    ok('A: trend shows Oct', monthLabels.includes('Oct 26') && monthLabels.includes('Jan 26'), monthLabels.join(','));
    ok('A: sr trend table has 10 rows', (await page.locator('#trendTable tbody tr').count()) === 10);
    ok('A: export button says Copy CSV without runtime', (await page.locator('#btnExport').innerText()) === 'Copy CSV');
    ok('A: Claude button hidden', await page.locator('#btnClaude').isHidden());

    await page.screenshot({ path: dir + 'docs/screenshots/desktop.png', fullPage: true });

    // 835 info tip
    ok('A: 835 tip hidden by default', !(await page.locator('#infoTip').isVisible()));
    await page.locator('#infoBtn').hover();
    ok('A: 835 tip shows on hover', (await page.locator('#infoTip').isVisible()) && /remittance advice/.test(await page.locator('#infoTip').innerText()));
    await page.mouse.move(5, 5);
    ok('A: 835 tip hides when mouse leaves', !(await page.locator('#infoTip').isVisible()));
    await page.locator('#infoBtn').focus();
    ok('A: 835 tip shows on keyboard focus', await page.locator('#infoTip').isVisible());
    await page.locator('#dateFrom').focus(); await page.mouse.move(5, 5);
    await page.locator('#infoBtn').click(); await page.mouse.move(5, 5);
    ok('A: 835 tip stays open after tap/click', await page.locator('#infoTip').isVisible());
    await page.keyboard.press('Escape');
    ok('A: Esc closes 835 tip', !(await page.locator('#infoTip').isVisible()));

    // service date filter
    await page.fill('#dateFrom', '2026-03-01'); await page.fill('#dateTo', '2026-03-31');
    await page.waitForTimeout(100);
    ok('A: date filter narrows ledger to 54', /^54 of 600/.test(await page.locator('#rowCountHint').innerText()), await page.locator('#rowCountHint').innerText());
    const kd = await page.locator('#kpiRow').innerText();
    ok('A: KPIs follow date filter (54 claims, 5 denied = 9.3%)', /54/.test(kd) && /9\.3%/.test(kd), kd.replace(/\n/g, ' | '));
    ok('A: summary follows date filter', /Of 54 claims/.test(await page.locator('#sumText').innerText()) || /54 claims/.test(await page.locator('#sumText').innerText()), await page.locator('#sumText').innerText());
    ok('A: date note shown while active', /no service date/.test(await page.locator('#dateMsg').innerText()));
    await page.fill('#dateFrom', '2026-04-01');
    ok('A: from after to warns and shows zero', /after the "to" date/.test(await page.locator('#dateMsg').innerText()) && /^0 of 600/.test(await page.locator('#rowCountHint').innerText()));
    await page.fill('#dateTo', ''); await page.fill('#dateFrom', '2026-09-01');
    ok('A: from-only works (93 claims)', /^93 of 600/.test(await page.locator('#rowCountHint').innerText()), await page.locator('#rowCountHint').innerText());
    await page.fill('#dateFrom', '');
    ok('A: clearing dates restores 600', /^600 of 600/.test(await page.locator('#rowCountHint').innerText()) && (await page.locator('#dateMsg').innerText()) === '');

    // category filter via button
    await page.locator('.catbar-row[data-cat="Coding/Billing Error"]').click();
    const hint = await page.locator('#rowCountHint').innerText();
    ok('A: category filter narrows ledger', /^44 of 600/.test(hint), hint);
    ok('A: category filter syncs dropdown', (await page.locator('#catFilter').inputValue()) === 'Coding/Billing Error');
    await page.locator('.catbar-row[data-cat="Coding/Billing Error"]').click();
    ok('A: second click clears filter', /^600 of 600/.test(await page.locator('#rowCountHint').innerText()));

    // search no match
    await page.fill('#searchBox', 'zzzz-no-match');
    ok('A: empty search shows zero without error', /0 claims match/.test(await page.locator('#pageInfo').innerText()));
    const kp0 = await page.locator('#kpiRow').innerText();
    ok('A: KPIs survive zero claims', /claims in view/i.test(kp0) && !/NaN/.test(kp0), kp0.replace(/\n/g, ' | '));
    ok('A: summary handles zero', /No claims match/.test(await page.locator('#sumText').innerText()));
    await page.fill('#searchBox', 'CLM-000001');
    ok('A: search one row', (await page.locator('#claimsBody tr[data-id]').count()) === 1);
    await page.fill('#searchBox', '');

    // keyboard open/close
    await page.locator('#claimsBody tr[data-id]').first().focus();
    await page.keyboard.press('Enter');
    ok('A: Enter opens drawer', await page.locator('#drawer.open').count() === 1);
    ok('A: focus moved to close button', await page.evaluate(() => document.activeElement.id) === 'drawerClose');
    await page.keyboard.press('Escape');
    ok('A: Esc closes drawer', await page.locator('#drawer.open').count() === 0);
    ok('A: focus returned to row', await page.evaluate(() => document.activeElement.tagName) === 'TR');

    // denied claim detail shows both codes with X12 wording
    await page.selectOption('#statusFilter', 'Denied');
    await page.locator('#claimsBody tr[data-id]').first().click();
    const dt = await page.locator('#drawerBody').innerText();
    ok('A: detail shows X12 wording line', /X12 wording:/.test(dt), dt.slice(dt.indexOf('Code translation'), dt.indexOf('Code translation') + 160).replace(/\n/g, ' '));
    ok('A: detail has no advice words', !/appeal|resubmit/i.test(dt.replace(/does not judge[^.]*\./i, '')), '');
    await page.keyboard.press('Escape');
    await page.selectOption('#statusFilter', '');

    // sample 835
    await page.click('#btnSample835');
    const k2 = await page.locator('#kpiRow').innerText();
    ok('A: sample 835 loads 9 claims', /Claims in view\s*\n?9/.test(k2) || /\b9\b/.test(k2), k2.replace(/\n/g, ' | ').slice(0, 80));
    const sm = await page.locator('#srcMsg').innerText();
    ok('A: load message mentions unmapped', /Read 9 claims/.test(sm) && /Other \/ Unmapped/.test(sm), sm);
    await page.fill('#searchBox', 'PCN1009');
    await page.locator('#claimsBody tr[data-id]').first().click();
    const d9 = await page.locator('#drawerBody').innerText();
    ok('A: unknown CARC handled', /not in this tool's reference set/i.test(d9), '');
    await page.keyboard.press('Escape');
    await page.fill('#searchBox', '');
    // bad paste
    await page.evaluate(() => { document.querySelector('details.paste').open = true; });
    await page.fill('#pasteBox', 'not an edi file');
    await page.click('#btnParsePaste');
    ok('A: bad paste shows error', /X12/.test(await page.locator('#srcMsg').innerText()));
    ok('A: bad paste keeps previous data', /\b9\b/.test(await page.locator('#kpiRow').innerText()));
    // XSS via 835 payload
    const evil = (await require('fs').promises.readFile(dir + 'data/sample_835.txt', 'utf8')).replace('ALDER HEALTH PLAN', '<img src=x onerror=window.__xss=1>');
    await page.fill('#pasteBox', evil);
    await page.click('#btnParsePaste');
    await page.waitForTimeout(200);
    ok('A: markup in payer name is inert', (await page.evaluate(() => window.__xss === 1)) === false && (await page.locator('#payerFilter option').allInnerTexts()).some(t => t.includes('<img')));
    // file input path
    await page.setInputFiles('#fileIn', dir + 'data/sample_835.txt');
    await page.waitForTimeout(300);
    ok('A: file chooser loads 835', /sample_835\.txt: 9 claims/.test(await page.locator('#srcHint').innerText()), await page.locator('#srcHint').innerText());
    await page.setInputFiles('#fileIn', dir + 'tests/fixtures/dental_style_835.txt');
    await page.waitForTimeout(300);
    ok('A: real-structure file loads with warning', /dental_style_835\.txt: 1 claim/.test(await page.locator('#srcHint').innerText()) && /several service lines/.test(await page.locator('#srcMsg').innerText()), await page.locator('#srcMsg').innerText());
    await page.click('#btnDemo');
    ok('A: back to demo', /600/.test(await page.locator('#kpiRow').innerText()));
    ok('A: no JS errors', errs.length === 0, errs.join(' || '));
    await ctx.close();
  }

  // ---------- Run B: with mocked claude runtime ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(MOCK);
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + dir + 'app/index.html');
    await page.waitForTimeout(500);
    ok('B: Download CSV label', (await page.locator('#btnExport').innerText()) === 'Download CSV');
    await page.locator('#sumBox > summary').click();
    ok('B: Claude button visible', await page.locator('#btnClaude').isVisible());
    await page.click('#btnExport');
    await page.waitForTimeout(100);
    const saved = await page.evaluate(() => window.__saved);
    ok('B: CSV saved with filename', saved && saved.filename === 'claimclarity-ledger.csv' && saved.data.split('\n').length === 601, saved && saved.data.split('\n').length);
    await page.selectOption('#statusFilter', 'Denied');
    await page.click('#btnExport');
    await page.waitForTimeout(100);
    ok('B: filtered export has 56 rows', (await page.evaluate(() => window.__saved.data.split('\n').length)) === 57);
    await page.selectOption('#statusFilter', '');
    await page.fill('#dateFrom', '2026-03-01'); await page.fill('#dateTo', '2026-03-31');
    await page.click('#btnExport'); await page.waitForTimeout(100);
    ok('B: date-filtered export has 54 rows', (await page.evaluate(() => window.__saved.data.split('\n').length)) === 55);
    await page.fill('#dateFrom', ''); await page.fill('#dateTo', '');
    await page.click('#btnClaude'); await page.waitForTimeout(200);
    ok('B: grounded Claude text accepted', /Written by Claude/.test(await page.locator('#sumBadge').textContent()));
    ok('B: prompt forbids advice', await page.evaluate(() => /do not give advice/.test(window.__prompt)));
    await page.evaluate(() => { window.__answer = 'Denials rose 47% after the new policy.'; });
    await page.selectOption('#payerFilter', { index: 1 }); // changes facts so the cache/prompt differs
    await page.click('#btnClaude'); await page.waitForTimeout(200);
    ok('B: ungrounded Claude text rejected', /not in the data/.test(await page.locator('#sumMsg').innerText()) && /Automatic summary/.test(await page.locator('#sumBadge').textContent()));
    await page.evaluate(() => { window.__answer = 'Of 600 claims, 56 were denied and providers should appeal.'; });
    await page.selectOption('#payerFilter', '');
    await page.click('#btnClaude'); await page.waitForTimeout(200);
    ok('B: advice wording rejected', /advice-style/.test(await page.locator('#sumMsg').innerText()));
    ok('B: no JS errors', errs.length === 0, errs.join('||'));
    await ctx.close();
  }

  // ---------- Run C: phone width, dark ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 800 }, colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('file://' + dir + 'app/index.html');
    await page.waitForTimeout(500);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok('C: no horizontal page scroll at 400px', over <= 0, 'overflow ' + over);
    await page.locator('#infoBtn').click();
    const tb = await page.evaluate(() => { const r = document.getElementById('infoTip').getBoundingClientRect(); return {l:r.left, r:r.right}; });
    ok('C: 835 tip fits inside phone width', tb.l >= 0 && tb.r <= 400, JSON.stringify(tb));
    await page.keyboard.press('Escape');
    ok('C: date filter inputs fit at 400px', await page.evaluate(() => { const r = document.querySelector('.dategrp').getBoundingClientRect(); return r.right <= 400 && r.left >= 0; }));
    await page.screenshot({ path: dir + 'docs/screenshots/phone-dark.png', fullPage: true });
    await page.locator('#claimsBody tr[data-id]').first().click();
    const dw = await page.evaluate(() => document.getElementById('drawer').getBoundingClientRect().width);
    ok('C: drawer fits phone', dw <= 400, dw);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nALL UI CHECKS PASSED');
  process.exit(fails ? 1 : 0);
})();
