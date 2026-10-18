/* Browser integration QA against the running Java + MySQL application.
 * Requires an npm playwright installation or a PLAYWRIGHT_MODULE override.
 * Run: node scripts/browser-smoke.cjs
 * Creates clearly named QA records. Do not run against a production database.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.QA_URL || 'http://127.0.0.1:8081';
const output = path.resolve(__dirname, '..', process.env.QA_ARTIFACT_DIR || '.local/screenshots');
const stamp = Date.now().toString().slice(-8);
const customerName = `Khách QA ${stamp}`;
const phone = `09${stamp}`;
const records = {customer_id:null,court_id:null,booking_ids:[]};
const errors = [];
fs.mkdirSync(output,{recursive:true});

async function run() {
  const systemChrome = process.platform === 'win32'
    ? path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe') : '';
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || process.env.CHROME_PATH
    || (systemChrome && fs.existsSync(systemChrome) ? systemChrome : undefined);
  const browser = await playwright.chromium.launch({headless:true,...(executablePath ? {executablePath} : {})});
  const page = await browser.newPage({viewport:{width:1440,height:1000},locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh'});
  page.on('pageerror',error => errors.push(error.message));
  const screenshot = async name => {
    await page.waitForFunction(() => document.getElementById('toast-root').children.length === 0,null,{timeout:8000});
    return page.screenshot({path:path.join(output,`${name}.png`),fullPage:true});
  };
  let csrf = '';
  async function request(method,endpoint,data) {
    const response = await page.request.fetch(`${base}${endpoint}`,{method,headers:csrf ? {'X-CSRF-TOKEN':csrf} : {},...(data !== undefined ? {data} : {})});
    const body = await response.json(); return {status:response.status(),...body};
  }
  async function selectSlots(ids) {
    for (const id of ids) await page.locator(`[data-action="select-slot"][data-court="3"][data-slot="${id}"]`).click();
    await page.locator('[data-action="checkout"]').click();
    await page.locator('[data-action="select-customer"]').first().waitFor();
  }
  async function pickExistingCustomer() {
    await page.fill('#checkout-search',phone);
    await page.locator(`[data-action="select-customer"][data-id="${records.customer_id}"]`).waitFor();
    await page.locator(`[data-action="select-customer"][data-id="${records.customer_id}"]`).click();
  }
  async function submitBooking() {
    const responsePromise = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/bookings');
    await page.locator('[form="checkout-form"]').click();
    const response = await responsePromise;
    const result = await response.json(); assert.equal(response.status(),201,JSON.stringify(result));
    records.booking_ids.push(result.data.id);
    await page.getByRole('heading',{name:result.data.booking_code,exact:true}).waitFor();
    return result.data;
  }
  async function cancelDialog() {
    await page.locator('[data-action="cancel-booking"]').click();
    const responsePromise = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/cancel'));
    await page.locator('[data-action="confirm-booking-action"]').click();
    const response = await responsePromise; assert.equal(response.status(),200);
    await page.locator('.modal-overlay').waitFor({state:'hidden'});
    await page.getByRole('heading',{name:'Lịch sân & đặt sân',exact:true}).waitFor();
  }
  try {
    await page.goto(base,{waitUntil:'networkidle'});
    await page.locator('#username').waitFor();
    await screenshot('01-login');
    await page.fill('#username','admin'); await page.fill('#password','wrong-password');
    await page.locator('#login-form button[type="submit"]').click();
    await page.waitForFunction(() => document.getElementById('login-error')?.textContent.trim().length > 0);
    assert.match(await page.locator('#login-error').innerText(),/không|sai|đăng nhập/i);
    await page.fill('#password','admin123'); await page.locator('#login-form button[type="submit"]').click();
    await page.getByRole('heading',{name:'Sẵn sàng cho một ngày mới.',exact:true}).waitFor();
    const session = await request('GET','/api/auth/session'); csrf = session.data.csrf_token;
    assert.equal(session.data.authenticated,true);
    await screenshot('02-dashboard');

    const config = (await request('GET','/api/config')).data;
    const date = new Date(`${config.today}T12:00:00Z`); date.setUTCDate(date.getUTCDate()+Number(process.env.QA_DAY_OFFSET || 5));
    const playDate = date.toISOString().slice(0,10);
    await page.locator('a[href="#booking"]').click();
    await page.getByRole('heading',{name:'Lịch sân & đặt sân',exact:true}).waitFor();
    await page.fill('#booking-date',playDate); await page.locator('#booking-date').dispatchEvent('change');
    await page.locator(`[data-action="select-slot"][data-court="3"][data-slot="3"]`).waitFor();
    await screenshot('03-calendar');
    await selectSlots([3,4]);
    await page.locator('[data-action="toggle-inline-customer"]').click();
    await page.fill('#inline-name',customerName); await page.fill('#inline-phone',phone);
    await page.fill('#inline-email',`qa${stamp}@example.com`);
    const customerResponse = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/customers');
    await page.locator('[data-action="save-inline-customer"]').click();
    const createdCustomerResponse = await customerResponse; assert.equal(createdCustomerResponse.status(),201);
    const createdCustomer = (await createdCustomerResponse.json()).data; records.customer_id = createdCustomer.id;
    await page.locator('#selected-customer-label').filter({hasText:customerName}).waitFor();
    const found = await request('GET',`/api/customers?q=${phone}`);
    assert.equal(found.data[0].full_name,customerName,'Customer was persisted and searchable.');
    await page.fill('#booking-note','Kiểm thử trình duyệt · hai giờ liên tiếp');
    await screenshot('04-checkout');
    const first = await submitBooking();
    assert.equal(first.slot_count,2); assert.equal(first.payment_status,'UNPAID');
    await screenshot('05-booking-detail');
    const duplicate = await request('POST','/api/bookings',{customer_id:records.customer_id,court_id:3,play_date:playDate,slot_ids:[3,4],note:'QA duplicate must fail'});
    assert.equal(duplicate.status,409,'Database rejects duplicate court/date/slot.');
    await cancelDialog();
    const released = (await request('GET',`/api/availability?date=${playDate}`)).data;
    assert(released.courts.find(c => c.id===3).slots.filter(s => [3,4].includes(s.time_slot_id)).every(s => s.available),'Cancellation releases both slots.');

    await selectSlots([3,4]); await pickExistingCustomer();
    const second = await submitBooking();
    await page.locator('[data-action="pay-booking"]').click();
    await page.selectOption('#payment-method','TRANSFER');
    const paidResponse = page.waitForResponse(r => new URL(r.url()).pathname === `/api/bookings/${second.id}/pay`);
    await page.locator('[form="payment-form"]').click();
    assert.equal((await paidResponse).status(),200);
    await page.getByRole('heading',{name:second.booking_code,exact:true}).waitFor();
    const paid = (await request('GET',`/api/bookings/${second.id}`)).data;
    assert.equal(paid.payment_status,'PAID'); assert.equal(paid.payment.method,'TRANSFER');
    assert.equal((await request('POST',`/api/bookings/${second.id}/cancel`,{})).status,409,'Paid booking cannot be cancelled.');
    await page.locator('[data-action="complete-booking"]').click();
    await page.locator('[data-action="confirm-booking-action"]').click();
    await page.waitForFunction(() => document.getElementById('modal-error')?.textContent.trim().length > 0);
    assert.match(await page.locator('#modal-error').innerText(),/kết thúc|giờ chơi/i,'Future booking cannot be completed.');
    await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();

    // Real conflict while checkout is open: another request acquires the chosen slots.
    await selectSlots([5,6]); await pickExistingCustomer();
    const competitor = await request('POST','/api/bookings',{customer_id:records.customer_id,court_id:3,play_date:playDate,slot_ids:[5,6],note:'QA competing reservation'});
    assert.equal(competitor.status,201); records.booking_ids.push(competitor.data.id);
    const conflictResponse = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/bookings');
    await page.locator('[form="checkout-form"]').click();
    assert.equal((await conflictResponse).status(),409);
    await page.waitForFunction(() => document.getElementById('modal-error')?.textContent.trim().length > 0);
    await screenshot('06-concurrent-conflict');
    assert.equal((await request('POST',`/api/bookings/${competitor.data.id}/cancel`,{})).status,200);
    await submitBooking(); await cancelDialog();

    await page.locator('a[href="#bookings"]').click();
    await page.getByRole('heading',{name:'Đơn đặt sân',exact:true}).waitFor();
    await page.locator('#booking-filter input[name="q"]').fill(phone);
    await page.locator('#booking-filter button[type="submit"]').click();
    await page.locator('table tbody tr').first().waitFor();
    assert((await page.locator('table tbody').innerText()).includes(customerName));
    await screenshot('07-bookings');

    await page.locator('a[href="#customers"]').click();
    await page.getByRole('heading',{name:'Khách hàng',exact:true}).waitFor();
    await page.fill('#customer-filter input',phone); await page.locator('#customer-filter button[type="submit"]').click();
    await page.locator(`[data-action="customer-history"][data-id="${records.customer_id}"]`).click();
    await page.getByRole('heading',{name:`Lịch sử · ${customerName}`,exact:true}).waitFor();
    assert.equal(await page.locator('.modal table tbody tr').count(),4);
    await screenshot('08-customer-history'); await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
    await page.locator(`[data-action="edit-customer"][data-id="${records.customer_id}"]`).click();
    await page.fill('#email',`updated${stamp}@example.com`); await page.locator('[form="customer-form"]').click();
    await page.locator('.modal-overlay').waitFor({state:'hidden'});
    assert.equal((await request('GET',`/api/customers?q=${phone}`)).data[0].email,`updated${stamp}@example.com`);
    await screenshot('09-customers');

    await page.locator('a[href="#courts"]').click();
    await page.getByRole('heading',{name:'Quản lý sân',exact:true}).waitFor();
    await page.locator('[data-action="new-court"]').click();
    await page.fill('#court-code',`QA-${stamp}`); await page.fill('#court-name',`Sân QA ${stamp}`);
    await page.fill('#hourly-price','220000'); await page.fill('#court-description','Sân tạo bởi kiểm thử giao diện.');
    const courtResponse = page.waitForResponse(r => r.request().method()==='POST' && new URL(r.url()).pathname==='/api/courts');
    await page.locator('[form="court-form"]').click(); const courtCreated=await courtResponse;assert.equal(courtCreated.status(),201);
    records.court_id=(await courtCreated.json()).data.id;await page.locator('.modal-overlay').waitFor({state:'hidden'});
    await page.locator(`[data-action="edit-court"][data-id="${records.court_id}"]`).click();
    await page.selectOption('#court-status','MAINTENANCE');await page.locator('[form="court-form"]').click();
    await page.locator('.modal-overlay').waitFor({state:'hidden'});
    assert.equal((await request('GET','/api/courts')).data.find(c=>c.id===records.court_id).status,'MAINTENANCE');
    await screenshot('10-courts');

    await page.locator('a[href="#reports"]').click();
    await page.getByRole('heading',{name:'Thống kê & doanh thu',exact:true}).waitFor();
    const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Xuất CSV'}).click();
    const download=await downloadPromise;await download.saveAs(path.join(output,'reports.csv'));
    assert(fs.readFileSync(path.join(output,'reports.csv'),'utf8').includes('Ngày'));
    await screenshot('11-reports');
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Reports fit mobile width.');
    await screenshot('12-mobile-reports');await page.locator('[data-action="menu"]').click();
    await page.locator('a[href="#booking"]').click();await page.getByRole('heading',{name:'Lịch sân & đặt sân',exact:true}).waitFor();
    await page.waitForTimeout(300);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Calendar timeline scrolls inside its card on mobile.');
    await screenshot('13-mobile-calendar');
    await page.locator('[data-action="menu"]').click();await page.locator('a[href="#dashboard"]').click();
    await page.getByRole('heading',{name:'Sẵn sàng cho một ngày mới.',exact:true}).waitFor();await page.waitForTimeout(300);
    await screenshot('14-mobile-dashboard');
    await page.locator('[data-action="menu"]').click();await page.locator('[data-action="logout"]').click();
    await page.locator('#username').waitFor();assert.equal((await request('GET','/api/auth/session')).data.authenticated,false);
    assert.deepEqual(errors,[],'No uncaught JavaScript errors.');
    console.log(JSON.stringify({result:'PASS',play_date:playDate,records,uncaught_errors:errors,screenshots:output},null,2));
  } finally { await browser.close(); }
}
run().catch(error=>{console.error(error);console.error('QA records created before failure:',records);process.exitCode=1;});
