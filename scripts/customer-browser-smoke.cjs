/* Real customer journeys against a separate QA Java/MySQL instance.
 * Set QA_URL=http://127.0.0.1:8081 before running. Never targets the main 8080 app.
 * Creates unique QA accounts, courts and booking history; does not delete history.
 */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.env.QA_URL) throw new Error('Set QA_URL to the separate QA application, for example http://127.0.0.1:8081.');
const endpoint = new URL(process.env.QA_URL);
if (!['127.0.0.1', 'localhost'].includes(endpoint.hostname) || endpoint.port === '8080')
  throw new Error('Customer smoke tests require a separate local QA application outside port 8080.');
const base = endpoint.origin;
const output = path.resolve(__dirname, '..', process.env.QA_ARTIFACT_DIR || '.local/screenshots', 'customer');
const password = 'CustomerQa123!';
const replacement = 'CustomerQa456!';
const records = [];
const errors = [];
fs.mkdirSync(output, {recursive:true});

async function api(context, method, route, body, csrf) {
  const response = await context.request.fetch(base + route, {
    method, headers:csrf ? {'X-CSRF-TOKEN':csrf} : {}, ...(body === undefined ? {} : {data:body})
  });
  return {status:response.status(), ...(await response.json())};
}
async function session(context) { return (await api(context, 'GET', '/api/auth/session')).data; }
function observe(page, name) { page.on('pageerror', error => errors.push(`${name}: ${error.message}`)); }
function responseFor(page, method, route) {
  return page.waitForResponse(response => response.request().method() === method && new URL(response.url()).pathname === route);
}
async function closeDialog(page) {
  const dialog = page.locator('#customer-dialog');
  if (await dialog.isVisible()) await dialog.locator('[data-action="close-dialog"]').first().click();
}
async function screenshot(page, name) {
  await page.screenshot({path:path.join(output, name + '.png'), fullPage:true});
}
async function fitsScreen(page, label) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label} fits the viewport`);
}

async function adminLogin(page) {
  await page.goto(base + '/quan-ly/', {waitUntil:'networkidle'});
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin123');
  const loggedIn = responseFor(page, 'POST', '/api/auth/login');
  await page.locator('#login-form button[type="submit"]').click();
  assert.equal((await loggedIn).status(), 200);
  await page.locator('.sidebar nav a[href="#bookings"]').waitFor();
  const user = await session(page.context());
  assert.equal(user.user.role, 'ADMIN');
  return user.csrf_token;
}

async function chooseAndBook(page, courtId, date, slots, note) {
  await closeDialog(page);
  await page.locator('nav a[href="#dat-san"]').click();
  await page.locator('#play-date').waitFor();
  if (await page.locator('#play-date').inputValue() !== date) {
    const loaded = responseFor(page, 'GET', '/api/customer/availability');
    await page.locator('#play-date').fill(date);
    await page.locator('#play-date').dispatchEvent('change');
    assert.equal((await loaded).status(), 200);
  }
  await page.locator(`[data-action="choose-court"][data-id="${courtId}"]`).click();
  for (const slot of slots) await page.locator(`.time-slot[data-action="choose-slot"][data-id="${slot}"]`).click();
  await page.locator('[data-action="checkout"]').click();
  await page.locator('#checkout-form').waitFor();
  await page.locator('#checkout-form [name="note"]').fill(note);
  const created = responseFor(page, 'POST', '/api/customer/bookings');
  await page.locator('#checkout-form button[type="submit"], button[form="checkout-form"][type="submit"]').click();
  const response = await created;
  const body = await response.json();
  assert.equal(response.status(), 201, JSON.stringify(body));
  await page.locator('#customer-dialog').filter({hasText:body.data.booking_code}).waitFor();
  return body.data;
}

async function customerLogin(page, username, value, expectedStatus) {
  await closeDialog(page);
  if (!await page.locator('#customer-login-form').isVisible()) await page.locator('[data-action="open-login"]').first().click();
  await page.locator('#customer-login-form [name="username"]').fill(username);
  await page.locator('#customer-login-form [name="password"]').fill(value);
  const loggedIn = responseFor(page, 'POST', '/api/auth/login');
  await page.locator('#customer-login-form button[type="submit"]').click();
  assert.equal((await loggedIn).status(), expectedStatus);
  if (expectedStatus === 200) await page.locator('[data-action="logout"]').first().waitFor();
}

async function journey(browser, adminPage, adminCsrf, label, viewport, dayOffset) {
  const tag = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  const username = 'Khách QA ' + tag;
  const email = 'qa.' + tag + '@example.com';
  const phone = '0' + crypto.randomInt(1_000_000_000).toString().padStart(9, '0');
  const name = 'Khách QA ' + tag;
  const record = {viewport:label, username, court_id:null, customer_id:null, booking_ids:[]};
  records.push(record);
  const court = await api(adminPage.context(), 'POST', '/api/courts', {
    code:'CQ-' + tag, name:'Sân khách QA ' + tag, description:'Sân riêng của kiểm thử cổng khách hàng.', hourly_price:150000, status:'ACTIVE'
  }, adminCsrf);
  assert.equal(court.status, 201); record.court_id = court.data.id;

  const context = await browser.newContext({viewport, locale:'vi-VN', timezoneId:'Asia/Ho_Chi_Minh'});
  const page = await context.newPage(); observe(page, label);
  page.setDefaultTimeout(12000);
  try {
    await page.goto(base + '/khach-hang/', {waitUntil:'networkidle'});
    await page.locator('#play-date').waitFor();
    assert.equal((await session(context)).authenticated, false);
    await fitsScreen(page, label + ' public calendar');
    await screenshot(page, label + '-01-public');
    await page.locator('[data-action="open-register"]').first().click();
    const registration = page.locator('#customer-register-form');
    await registration.waitFor();
    for (const [field, value] of Object.entries({username, full_name:name, phone, email, password, password_confirm:password}))
      await registration.locator(`[name="${field}"]`).fill(value);
    assert.equal(await registration.locator('[name="username"]').getAttribute('pattern'), null, 'Usernames must allow Vietnamese and internal spaces');
    for (const rejected of ['password1!', 'Password!!', 'Password12', 'Password1 ']) {
      await registration.locator('[name="password"]').fill(rejected);
      await registration.locator('[name="password_confirm"]').fill(rejected);
      await registration.locator('button[type="submit"]').click();
      await page.locator('#auth-error').filter({hasText:/hoa|số|đặc biệt/i}).waitFor();
      assert.equal((await session(context)).authenticated, false, 'Invalid passwords must not create a signed-in account');
    }
    await registration.locator('[name="password"]').fill(password);
    await registration.locator('[name="password_confirm"]').fill(password);
    await fitsScreen(page, label + ' registration');
    await screenshot(page, label + '-02-register');
    const registered = responseFor(page, 'POST', '/api/auth/register');
    await registration.locator('button[type="submit"]').click();
    assert.equal((await registered).status(), 201);
    await page.locator('[data-action="logout"]').first().waitFor();
    const account = await session(context);
    assert.equal(account.user.role, 'CUSTOMER'); record.customer_id = account.user.customer_id;
    const config = (await api(context, 'GET', '/api/customer/config')).data;
    const date = new Date(config.today + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + dayOffset);
    const playDate = date.toISOString().slice(0, 10);
    const slots = config.time_slots.slice(12, 14).map(slot => slot.id);
    record.play_date = playDate;

    const first = await chooseAndBook(page, record.court_id, playDate, slots, 'Đặt từ trình duyệt ' + label);
    record.booking_ids.push(first.id);
    assert.equal(first.customer_id, record.customer_id); assert.equal(first.slot_count, 2);
    assert.equal(Number(first.total_amount), 300000); assert.equal(first.can_cancel, true);
    await fitsScreen(page, label + ' booking detail');
    await screenshot(page, label + '-03-booking-detail');
    await page.locator('#customer-dialog [data-action="cancel-booking"]').click();
    const cancelled = responseFor(page, 'POST', `/api/customer/bookings/${first.id}/cancel`);
    await page.locator('#cancel-form button[type="submit"], button[form="cancel-form"][type="submit"]').click();
    assert.equal((await cancelled).status(), 200);
    await closeDialog(page);
    const cancelledData = (await api(context, 'GET', `/api/customer/bookings/${first.id}`)).data;
    assert.equal(cancelledData.status, 'CANCELLED'); assert.equal(cancelledData.can_cancel, false);
    const availability = (await api(context, 'GET', '/api/customer/availability?date=' + playDate)).data;
    const released = availability.courts.find(item => item.id === record.court_id).slots.filter(slot => slots.includes(slot.time_slot_id));
    assert.equal(released.length, 2); assert(released.every(slot => slot.available));
    assert(!JSON.stringify(availability).includes('booking_id'), 'Public schedule must hide booking identifiers');

    const second = await chooseAndBook(page, record.court_id, playDate, slots, 'Đặt lại sau khi hủy ' + label);
    record.booking_ids.push(second.id);
    await closeDialog(page);
    await page.locator('nav a[href="#don-cua-toi"]').click();
    await page.locator(`[data-action="detail"][data-id="${second.id}"]`).waitFor();
    assert.equal(await page.locator('.booking-card').count(), 2);
    await fitsScreen(page, label + ' history'); await screenshot(page, label + '-04-history');

    await page.locator('nav a[href="#tai-khoan"]').click();
    await page.locator('#profile-form').waitFor();
    await page.locator('#profile-form [name="full_name"]').fill(name + ' cập nhật');
    await page.locator('#profile-form [name="email"]').fill('updated.qa.' + tag + '@example.com');
    const saved = responseFor(page, 'PUT', '/api/customer/me');
    await page.locator('#profile-form button[type="submit"]').click();
    assert.equal((await saved).status(), 200);
    assert.equal((await api(context, 'GET', '/api/customer/me')).data.full_name, name + ' cập nhật');
    await fitsScreen(page, label + ' profile'); await screenshot(page, label + '-05-profile');
    for (const rejected of ['password1!', 'Password!!', 'Password12', 'Password1 ']) {
      for (const [field, value] of Object.entries({current_password:password, new_password:rejected, new_password_confirm:rejected}))
        await page.locator(`#password-form [name="${field}"]`).fill(value);
      await page.locator('#password-form button[type="submit"]').click();
      await page.locator('#password-error').filter({hasText:/hoa|số|đặc biệt/i}).waitFor();
    }
    const tokenBefore = (await session(context)).csrf_token;
    for (const [field, value] of Object.entries({current_password:password, new_password:replacement, new_password_confirm:replacement}))
      await page.locator(`#password-form [name="${field}"]`).fill(value);
    const passwordChanged = responseFor(page, 'PUT', '/api/customer/password');
    await page.locator('#password-form button[type="submit"]').click();
    assert.equal((await passwordChanged).status(), 200);
    await page.waitForFunction(() => !document.querySelector('#password-form button[type="submit"]').disabled);
    assert.notEqual((await session(context)).csrf_token, tokenBefore);
    const loggedOut = responseFor(page, 'POST', '/api/auth/logout');
    await page.locator('[data-action="logout"]').first().click();
    assert.equal((await loggedOut).status(), 200);
    await customerLogin(page, username, password, 401);
    await customerLogin(page, username, replacement, 200);
    assert.equal((await session(context)).user.customer_id, record.customer_id);
    assert.equal((await api(context, 'GET', '/api/customers')).status, 403);

    // Staff sees and charges the exact reservation created in the customer UI.
    await adminPage.locator('.sidebar nav a[href="#bookings"]').click();
    await adminPage.locator('#booking-filter input[name="q"]').fill(phone);
    await adminPage.locator('#booking-filter button[type="submit"]').click();
    await adminPage.locator(`[data-action="booking-detail"][data-id="${second.id}"]`).click();
    await adminPage.getByRole('heading', {name:second.booking_code, exact:true}).waitFor();
    await screenshot(adminPage, label + '-06-admin-same-booking');
    await adminPage.locator('[data-action="pay-booking"]').click();
    await adminPage.locator('#payment-method').selectOption('TRANSFER');
    const paid = responseFor(adminPage, 'POST', `/api/bookings/${second.id}/pay`);
    await adminPage.locator('[form="payment-form"]').click();
    assert.equal((await paid).status(), 200);
    await adminPage.getByRole('heading', {name:second.booking_code, exact:true}).waitFor();
    await adminPage.locator('[data-action="close-modal"]').click();
    await page.goto(base + '/khach-hang/#don-cua-toi', {waitUntil:'networkidle'});
    await page.locator(`[data-action="detail"][data-id="${second.id}"]`).click();
    await page.locator('#customer-dialog').filter({hasText:second.booking_code}).waitFor();
    const payment = (await api(context, 'GET', `/api/customer/bookings/${second.id}`)).data;
    assert.equal(payment.payment_status, 'PAID'); assert.equal(payment.payment.method, 'TRANSFER'); assert.equal(payment.can_cancel, false);
    const cancelButton = page.locator('#customer-dialog [data-action="cancel-booking"]');
    assert(await cancelButton.count() === 0 || await cancelButton.isDisabled(), 'Paid customer booking cannot be cancelled in the UI');
    await fitsScreen(page, label + ' paid detail'); await screenshot(page, label + '-07-paid-detail');
  } catch (error) {
    await screenshot(page, label + '-failure').catch(() => {});
    throw error;
  } finally { await context.close(); }
}

async function run() {
  const systemChrome = process.platform === 'win32'
    ? path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe') : '';
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || process.env.CHROME_PATH
    || (systemChrome && fs.existsSync(systemChrome) ? systemChrome : undefined);
  const browser = await playwright.chromium.launch({headless:true, ...(executablePath ? {executablePath} : {})});
  try {
    const adminContext = await browser.newContext({viewport:{width:1440, height:1000}, locale:'vi-VN', timezoneId:'Asia/Ho_Chi_Minh'});
    const adminPage = await adminContext.newPage(); observe(adminPage, 'admin');
    const csrf = await adminLogin(adminPage);
    await journey(browser, adminPage, csrf, 'desktop', {width:1440, height:1000}, 22);
    await journey(browser, adminPage, csrf, 'mobile', {width:390, height:844}, 23);
    assert.deepEqual(errors, [], 'No uncaught JavaScript errors in customer or admin journeys');
    console.log(JSON.stringify({result:'PASS', records, uncaught_errors:errors, screenshots:output}, null, 2));
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); console.error('QA records created before failure:', JSON.stringify(records)); process.exitCode = 1; });
