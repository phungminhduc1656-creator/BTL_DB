'use strict';
// Giao diện khách hàng: chủ đơn luôn được xác định từ phiên đăng nhập phía máy chủ.
const svgPaths = {
  court:'<rect x="5" y="2" width="14" height="20" rx="1"/><path d="M5 12h14M5 7h14M5 17h14M12 2v5M12 17v5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', check:'<path d="m5 12 4 4L19 6"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6a8 8 0 0 1 13.4 3M4.5 15a8 8 0 0 0 13.4 3"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  list:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svgPaths[name] || svgPaths.court}</svg>`;
const art = `<svg class="hero-art" viewBox="0 0 250 330" fill="none" aria-hidden="true"><rect x="25" y="15" width="200" height="300" rx="5" fill="currentColor" opacity=".13"/><rect x="39" y="30" width="172" height="270" stroke="currentColor" stroke-width="3"/><path d="M39 165h172M39 115h172M39 215h172M125 30v85M125 215v85" stroke="currentColor" stroke-width="3"/><path d="M25 165h200" stroke="currentColor" stroke-width="6"/><circle class="ball-dot" cx="181" cy="259" r="22" stroke-width="2"/><circle cx="174" cy="252" r="3" fill="currentColor"/><circle cx="189" cy="254" r="3" fill="currentColor"/><circle cx="181" cy="268" r="3" fill="currentColor"/></svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(value) || 0);
const time = value => String(value || '').slice(0,5);
const dateLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? value.split('-').reverse().join('/') : '—';
const datetimeLabel = value => value ? `${time(String(value).slice(11))} · ${dateLabel(String(value).slice(0,10))}` : '—';
const statusLabels = {CONFIRMED:'Đã xác nhận',CANCELLED:'Đã hủy',COMPLETED:'Hoàn thành'};
const app = document.getElementById('customer-app');
const dialog = document.getElementById('customer-dialog');
const state = {user:null,csrf:'',config:null,courts:[],date:'',availability:null,courtId:null,slotIds:[],route:'dat-san',filter:'',bookings:[],profile:null,request:0,pendingCheckout:false,dialogMode:'',dialogBooking:null,dialogReturnFocus:null};
const customerLoggedIn = () => state.user?.role === 'CUSTOMER';
const selectedCourt = () => state.availability?.courts.find(c => String(c.id) === String(state.courtId));
const selectedSlots = () => (selectedCourt()?.slots || []).filter(s => state.slotIds.includes(Number(s.time_slot_id))).sort((a,b) => a.start_time.localeCompare(b.start_time));
const actionButton = (label, action, className = '', attributes = '') => `<button type="button" class="btn ${className}" data-action="${action}" ${attributes}>${esc(label)}</button>`;
const busyMarkup = '<div class="loading" role="status"><span class="spinner"></span>Đang tải dữ liệu…</div>';
const getRoute = () => ['dat-san','don-cua-toi','tai-khoan'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'dat-san';
async function api(path, {method = 'GET', body} = {}) {
  const headers = {Accept:'application/json'};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && state.csrf) headers['X-CSRF-TOKEN'] = state.csrf;
  let response;
  try { response = await fetch(path,{method,headers,credentials:'same-origin',...(body !== undefined ? {body:JSON.stringify(body)} : {})}); }
  catch { throw new Error('Chưa kết nối được với máy chủ. Vui lòng kiểm tra ứng dụng và thử lại.'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('Máy chủ chưa trả về dữ liệu hợp lệ. Vui lòng tải lại trang.'); }
  if (!response.ok) {
    const error = new Error(result.message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.'); error.status = response.status;
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      state.user = null;
      try { await refreshSession(); } catch { /* Giữ thông báo của yêu cầu ban đầu. */ }
      renderHeader();
    }
    throw error;
  }
  return result.data;
}
async function refreshSession() { const data = await api('/api/auth/session'); state.user = data.authenticated ? data.user : null; state.csrf = data.csrf_token; return data; }
function toast(message, error = false) {
  const element = document.createElement('div'); element.className = `toast${error ? ' error' : ''}`; element.textContent = message;
  const root = document.getElementById('toast-root'); while (root.children.length >= 3) root.firstElementChild.remove(); root.append(element);
  setTimeout(() => element.remove(),error ? 7000 : 5000);
}
function badge(status) { return `<span class="badge ${({CONFIRMED:'green',CANCELLED:'red',COMPLETED:'blue'})[status] || 'grey'}">${esc(statusLabels[status] || status)}</span>`; }
function paymentBadge(booking) { return `<span class="badge ${booking.payment_status === 'PAID' ? 'green' : booking.status === 'CANCELLED' ? 'grey' : 'amber'}">${booking.payment_status === 'PAID' ? 'Đã thanh toán' : booking.status === 'CANCELLED' ? 'Đã hủy · không thu tiền' : 'Thanh toán tại sân'}</span>`; }
function empty(title, description, action = '', symbol = 'list') { return `<div class="empty">${icon(symbol)}<h2>${esc(title)}</h2><p>${esc(description)}</p>${action}</div>`; }
function setMain(markup) { const target = document.getElementById('main-content'); if (target) target.innerHTML = markup; }
function shell() {
  app.innerHTML = `<header class="site-header"><div class="wrap header-inner" id="customer-header"></div></header><main class="wrap" id="main-content" tabindex="-1"></main><footer class="site-footer"><div class="wrap footer-inner"><span>Courtly. · Không gian khách hàng<br>Đặt sân pickleball theo khung giờ một tiếng.</span><a href="/quan-ly/">Dành cho quản lý sân</a></div></footer>`;
  renderHeader();
}
function renderHeader() {
  const target = document.getElementById('customer-header'); if (!target) return;
  const customer = customerLoggedIn();
  target.innerHTML = `<a href="#dat-san" aria-label="Courtly · Trang đặt sân"><div class="brand">${icon('court')}Courtly<span>.</span></div><div class="brand-space">Không gian khách hàng</div></a><nav class="nav" aria-label="Điều hướng khách hàng">${[['dat-san','Đặt sân'],['don-cua-toi','Đơn của tôi'],['tai-khoan','Tài khoản']].map(([id,label]) => `<a href="#${id}" class="${state.route === id ? 'active' : ''}" ${state.route === id ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav><div class="header-actions">${customer ? `<a href="#tai-khoan" class="user-pill" title="${esc(state.user.display_name)}">Chào, ${esc(state.user.display_name)}</a><button class="icon-btn" type="button" data-action="logout" title="Đăng xuất" aria-label="Đăng xuất">${icon('logout')}</button>` : state.user ? '<a class="btn secondary small" href="/quan-ly/">Trang quản lý</a><button class="icon-btn" type="button" data-action="logout" title="Đăng xuất quản lý" aria-label="Đăng xuất quản lý">'+icon('logout')+'</button>' : `${actionButton('Đăng nhập','open-login','secondary')}${actionButton('Đăng ký','open-register')}`}</div>`;
}
function sectionTitle(eyebrow, title, description, extra = '') { return `<div class="section-title"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${extra}</div>`; }
function privateGate(title) {
  if (state.user?.role === 'ADMIN') return `<div class="page-space"><div class="panel">${empty('Bạn đang dùng tài khoản quản lý','Không gian này dành cho tài khoản khách hàng. Bạn có thể trở về quản lý hoặc đăng xuất để đăng nhập bằng tài khoản khách.',`<a href="/quan-ly/" class="btn">Mở trang quản lý</a> ${actionButton('Đăng xuất','logout','secondary')}`,'user')}</div></div>`;
  return `<div class="page-space"><div class="panel">${empty(title,'Đăng nhập để xem các đơn đã đặt và quản lý thông tin của chính bạn.',`${actionButton('Đăng nhập','open-login')} ${actionButton('Tạo tài khoản','open-register','secondary')}`,'user')}</div></div>`;
}
async function loadPage() {
  const request = ++state.request; state.route = getRoute(); renderHeader();
  if (state.route !== 'dat-san' && !customerLoggedIn()) { setMain(privateGate(state.route === 'don-cua-toi' ? 'Lịch chơi của bạn ở đây' : 'Tài khoản của bạn')); return; }
  setMain(busyMarkup);
  try {
    if (state.route === 'dat-san') {
      const data = await api(`/api/customer/availability?date=${encodeURIComponent(state.date)}`); if (request !== state.request) return;
      state.availability = data;
      const active = data.courts.filter(c => c.status === 'ACTIVE');
      if (!active.some(c => String(c.id) === String(state.courtId))) { state.courtId = active[0]?.id ?? null; state.slotIds = []; }
      const before = state.slotIds.length;
      state.slotIds = state.slotIds.filter(id => selectedCourt()?.slots.some(s => Number(s.time_slot_id) === id && s.available));
      if (before !== state.slotIds.length) { state.slotIds = []; toast('Lịch sân vừa thay đổi. Vui lòng chọn lại khung giờ trống.',true); }
      renderBooking();
    } else if (state.route === 'don-cua-toi') {
      const data = await api(`/api/customer/bookings${state.filter ? '?status='+encodeURIComponent(state.filter) : ''}`); if (request !== state.request) return;
      state.bookings = data; renderHistory();
    } else {
      const data = await api('/api/customer/me'); if (request !== state.request) return;
      state.profile = data; renderProfile();
    }
  } catch (error) {
    if (request !== state.request) return;
    if (error.status === 401) setMain(privateGate('Đăng nhập lại để tiếp tục'));
    else setMain(`<div class="page-space"><div class="panel">${empty('Chưa tải được dữ liệu',error.message,actionButton('Thử lại','reload','secondary'),'refresh')}</div></div>`);
  }
}
function renderBooking() {
  const court = selectedCourt();
  setMain(`<section class="hero"><div class="hero-copy"><div class="eyebrow">SÂN ĐÃ SẴN SÀNG. CÒN BẠN?</div><h1>Ra sân.<br><em>Chơi hết mình.</em></h1><p>Chọn ngày, tìm khung giờ vừa ý và hẹn đồng đội.<br>Lịch trống được cập nhật trực tiếp từ hệ thống.</p><div class="hero-facts"><span>${icon('clock')}Khung giờ 06:00 – 23:00</span><span>${icon('calendar')}Đặt trước tối đa 30 ngày</span><span>${icon('check')}Giá rõ ràng theo giờ</span></div></div>${art}</section><section aria-labelledby="booking-heading"><div class="section-title"><div><div class="eyebrow">HẸN NHAU TRÊN SÂN</div><h2 id="booking-heading">Chọn lịch chơi của bạn</h2><p>Chọn một sân và các khung giờ liền nhau.</p></div><div class="date-field"><label for="play-date">Ngày chơi</label><input type="date" id="play-date" value="${esc(state.date)}" min="${esc(state.config.today)}" max="${esc(state.config.max_booking_date)}" required></div></div>${state.user?.role === 'ADMIN' ? '<div class="role-notice">Bạn đang đăng nhập bằng tài khoản quản lý. Để đặt sân tại đây, hãy đăng xuất rồi dùng tài khoản khách hàng.</div><br>' : ''}<div class="booking-layout"><div class="panel"><div class="steps" aria-label="Các bước đặt sân"><span><b>1</b>Chọn ngày</span><i>→</i><span><b>2</b>Chọn sân & giờ</span><i>→</i><span><b>3</b>Xác nhận đặt sân</span></div>${state.availability.courts.length ? `<div class="court-tabs" aria-label="Chọn sân">${state.availability.courts.map(c => `<button type="button" class="court-tab" data-action="choose-court" data-id="${esc(c.id)}" aria-pressed="${String(c.id) === String(state.courtId)}" ${c.status !== 'ACTIVE' ? 'disabled' : ''}><strong>${esc(c.name)}</strong><small>${money(c.hourly_price)} / giờ</small><span class="court-tab-count">${c.status === 'ACTIVE' ? `${c.slots.filter(s => s.available).length} khung giờ trống` : c.status === 'MAINTENANCE' ? 'Đang bảo trì' : 'Tạm ngừng hoạt động'}</span></button>`).join('')}</div>${court ? `<p class="court-description">${esc(court.description || 'Chọn khung giờ trống bên dưới để bắt đầu đặt sân.')}<br>Đơn giá: <strong>${money(court.hourly_price)} / giờ</strong> · Ngày ${dateLabel(state.date)}</p><div class="legend" aria-label="Chú thích khung giờ"><span><i class="swatch"></i>Còn trống</span><span><i class="swatch selected"></i>Đang chọn</span><span><i class="swatch booked"></i>Đã có người đặt</span><span><i class="swatch past"></i>Đã qua / không mở</span></div><div class="slot-grid">${court.slots.map(s => { const selected = state.slotIds.includes(Number(s.time_slot_id)); const label = s.available ? selected ? 'Đang chọn' : 'Còn trống' : s.reason === 'BOOKED' ? 'Đã được đặt' : s.reason === 'PAST' ? 'Đã qua giờ' : 'Không mở'; return `<button type="button" class="time-slot ${selected ? 'selected' : s.available ? '' : s.reason === 'BOOKED' ? 'booked' : 'unavailable'}" data-action="choose-slot" data-id="${esc(s.time_slot_id)}" aria-pressed="${selected}" aria-label="${time(s.start_time)} đến ${time(s.end_time)}: ${label}" ${s.available ? '' : 'disabled'}><span>${time(s.start_time)} – ${time(s.end_time)}</span><small>${label}</small></button>`; }).join('')}</div>` : empty('Các sân đang tạm ngừng nhận đặt','Bạn vui lòng quay lại sau hoặc chọn ngày khác.','','court')}` : empty('Chưa có sân để đặt','Quản lý chưa mở sân trong hệ thống. Bạn vui lòng quay lại sau.','','court')}<div class="board-foot"><span>Chỗ chỉ được giữ sau khi xác nhận đặt sân thành công.</span><button type="button" class="icon-btn" data-action="reload" title="Cập nhật lịch sân" aria-label="Cập nhật lịch sân">${icon('refresh')}</button></div></div><aside class="selection" id="selection-panel" aria-label="Thông tin giờ đã chọn"></aside></div></section><section class="info-strip" aria-label="Thông tin đặt sân"><div class="info-item">${icon('calendar')}<div><h3>Lịch của bạn, ngay trong tài khoản</h3><p>Xem lại giờ chơi, trạng thái đơn và thông tin thanh toán ở mục Đơn của tôi.</p></div></div><div class="info-item">${icon('shield')}<div><h3>Chủ động thay đổi kế hoạch</h3><p>Có thể hủy đơn chưa thanh toán trước giờ bắt đầu. Giờ sân được mở lại ngay sau khi hủy.</p></div></div><div class="info-item">${icon('check')}<div><h3>Thanh toán tại sân</h3><p>Thanh toán với quản lý. Biên nhận và trạng thái sẽ được cập nhật trong đơn của bạn.</p></div></div></section>`);
  renderSelection();
}
function renderSelection() {
  const target = document.getElementById('selection-panel'); if (!target) return;
  const court = selectedCourt(); const slots = selectedSlots();
  target.innerHTML = `<div class="panel"><div class="panel-pad"><div class="eyebrow">LỊCH CHƠI ĐÃ CHỌN</div>${slots.length ? `<h3>${esc(court.name)}</h3><div class="date">${dateLabel(state.date)} · ${slots.length} giờ chơi</div><div class="slot-chips">${slots.map(s => `<span>${time(s.start_time)} – ${time(s.end_time)}</span>`).join('')}</div><div class="price-line"><span>Giá mỗi giờ</span><span>${money(court.hourly_price)}</span></div><div class="price-line"><span>Số giờ</span><span>${slots.length} giờ</span></div><div class="total-line"><span>Tổng tiền</span><strong>${money(Number(court.hourly_price)*slots.length)}</strong></div>${actionButton('Tiếp tục đặt sân','checkout')}<p class="selection-hint">${customerLoggedIn() ? 'Kiểm tra thông tin trước khi xác nhận.' : 'Đăng nhập hoặc đăng ký để xác nhận.'}<br><button type="button" class="text-btn" data-action="clear-selection">Chọn lại giờ</button></p>` : `<div class="blank-selection">${icon('court')}Chưa có giờ chơi được chọn.<br>Chọn các khung giờ trống cạnh nhau để xem tổng tiền.</div>`}</div></div><div class="policy"><strong>Đặt sân dễ dàng</strong>Mỗi khung kéo dài 1 giờ. Một đơn dành cho một sân, một ngày và các giờ liên tiếp. Bạn có thể đặt thêm đơn cho lịch chơi khác.</div>`;
}
function chooseSlot(id) {
  const court = selectedCourt(); if (!court) return;
  const slots = court.slots; const slot = slots.find(s => Number(s.time_slot_id) === id); if (!slot?.available) return;
  const indices = state.slotIds.map(selected => slots.findIndex(s => Number(s.time_slot_id) === selected)).sort((a,b) => a-b);
  const index = slots.indexOf(slot);
  if (!indices.length) state.slotIds = [id];
  else if (state.slotIds.includes(id)) {
    if (index === indices[0] || index === indices[indices.length-1]) state.slotIds = state.slotIds.filter(value => value !== id);
    else { state.slotIds = [id]; toast('Đã chọn lại một giờ. Chọn thêm các giờ cạnh bên nếu cần.'); }
  } else if (index === indices[0]-1 || index === indices[indices.length-1]+1) state.slotIds.push(id);
  else { state.slotIds = [id]; toast('Bắt đầu lịch mới từ giờ này. Các giờ trong một đơn cần liền nhau.'); }
  document.querySelectorAll('.time-slot[data-id]').forEach(button => { const selected = state.slotIds.includes(Number(button.dataset.id)); button.classList.toggle('selected',selected); button.setAttribute('aria-pressed',String(selected)); if (!button.disabled) { const s = slots.find(row => Number(row.time_slot_id) === Number(button.dataset.id)); const label = selected ? 'Đang chọn' : 'Còn trống'; button.querySelector('small').textContent = label; button.setAttribute('aria-label',`${time(s.start_time)} đến ${time(s.end_time)}: ${label}`); } });
  renderSelection();
}
function renderHistory() {
  setMain(`<div class="page-space">${sectionTitle('LỊCH CHƠI CÁ NHÂN','Đơn của tôi','Theo dõi những cuộc hẹn trên sân, từ lúc đặt đến khi hoàn thành.','<a class="btn" href="#dat-san">Đặt thêm sân '+icon('arrow')+'</a>')}<div class="filters" aria-label="Lọc trạng thái đơn">${[['','Tất cả'],['CONFIRMED','Đã xác nhận'],['COMPLETED','Hoàn thành'],['CANCELLED','Đã hủy']].map(([value,label]) => `<button class="filter-btn ${state.filter === value ? 'active' : ''}" type="button" data-action="filter-bookings" data-status="${value}" aria-pressed="${state.filter === value}">${label}</button>`).join('')}</div>${state.bookings.length ? `<div class="booking-list">${state.bookings.map(b => `<article class="booking-card" data-booking-id="${esc(b.id)}"><div><div class="booking-top"><span class="booking-code">${esc(b.booking_code)}</span>${badge(b.status)}</div><h3>${esc(b.court_name)}</h3><div class="booking-meta"><span>${icon('calendar')}${dateLabel(b.play_date)}</span><span>${icon('clock')}${time(b.start_time)} – ${time(b.end_time)} · ${Number(b.slot_count)} giờ</span></div>${paymentBadge(b)}</div><div class="booking-card-side"><div class="booking-price">${money(b.total_amount)}</div><div class="booking-actions">${actionButton('Xem chi tiết','detail','secondary small',`data-id="${esc(b.id)}"`)}</div></div></article>`).join('')}</div><p class="muted small" style="margin-top:17px">${state.bookings.length} đơn${state.bookings.length >= 500 ? ' · Hiển thị tối đa 500 đơn mới nhất' : ''} · Thanh toán được quản lý cập nhật tại sân.</p>` : `<div class="panel">${empty(state.filter ? 'Chưa có đơn ở trạng thái này' : 'Cuộc hẹn đầu tiên đang chờ bạn',state.filter ? 'Chọn trạng thái khác hoặc đặt thêm một lịch chơi mới.' : 'Chọn sân, chọn giờ và tạo đơn đặt sân đầu tiên của bạn.','<a class="btn" href="#dat-san">Khám phá lịch sân</a>','calendar')}</div>`}</div>`);
}
function renderProfile() {
  const p = state.profile;
  setMain(`<div class="page-space">${sectionTitle('THÔNG TIN CÁ NHÂN','Tài khoản của tôi','Cập nhật thông tin liên hệ và bảo vệ tài khoản của bạn.')}<div class="profile-layout"><section class="panel"><div class="panel-heading"><div><h2>Hồ sơ khách hàng</h2><p>Tên đăng nhập: <strong>${esc(p.username || state.user.username)}</strong></p></div>${icon('user')}</div><div class="panel-pad"><form id="profile-form"><div class="error-message" id="profile-error" role="alert"></div><div class="field"><label for="profile-name">Họ và tên</label><input id="profile-name" name="full_name" value="${esc(p.full_name)}" required minlength="2" maxlength="100" autocomplete="name"></div><div class="field"><label for="profile-phone">Số điện thoại</label><input id="profile-phone" name="phone" type="tel" value="${esc(p.phone)}" pattern="(0[0-9]{9,10}|[+]84[0-9]{9,10})" required maxlength="20" autocomplete="tel"><p class="field-hint">Dùng số Việt Nam bắt đầu bằng 0 hoặc +84.</p></div><div class="field"><label for="profile-email">Email <span class="muted">(không bắt buộc)</span></label><input id="profile-email" name="email" type="email" value="${esc(p.email || '')}" maxlength="150" autocomplete="email"></div><button class="btn" type="submit">Lưu thông tin</button></form></div></section><section class="panel"><div class="panel-heading"><div><h2>Đổi mật khẩu</h2><p>Xác nhận mật khẩu hiện tại để thay đổi.</p></div>${icon('shield')}</div><div class="panel-pad"><form id="password-form"><div class="error-message" id="password-error" role="alert"></div><div class="field"><label for="current-password">Mật khẩu hiện tại</label><input id="current-password" name="current_password" type="password" required maxlength="100" autocomplete="current-password"></div><div class="field"><label for="new-password">Mật khẩu mới</label><input id="new-password" name="new_password" type="password" required minlength="8" maxlength="72" autocomplete="new-password"><p class="field-hint">Ít nhất 8 ký tự, tối đa 72 byte UTF-8; bắt buộc có chữ hoa, chữ số và ký tự đặc biệt (ví dụ !, @, #). Khoảng trắng không tính là ký tự đặc biệt.</p></div><div class="field"><label for="confirm-password">Nhập lại mật khẩu mới</label><input id="confirm-password" name="new_password_confirm" type="password" required minlength="8" maxlength="72" autocomplete="new-password"></div><button class="btn" type="submit">Cập nhật mật khẩu</button></form></div></section></div><div class="policy"><strong>Thông tin đặt sân được giữ nguyên</strong>Cập nhật hồ sơ không thay đổi giờ chơi hay giá của các đơn đã đặt. Nếu cần xử lý đơn đã thanh toán hoặc đã đến giờ chơi, bạn vui lòng trao đổi trực tiếp với quản lý sân.</div></div>`);
}
function openDialog(title, subtitle, body, footer = '') {
  if (!dialog.open) state.dialogReturnFocus = document.activeElement;
  dialog.innerHTML = `<div class="dialog-head"><div><h2 id="dialog-title">${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div><button type="button" class="icon-btn" data-action="close-dialog" aria-label="Đóng cửa sổ">${icon('close')}</button></div><div class="dialog-body">${body}</div>${footer ? `<div class="dialog-foot">${footer}</div>` : ''}`;
  if (!dialog.open) dialog.showModal();
  const firstInput = dialog.querySelector('input:not([type=hidden])'); if (firstInput) firstInput.focus(); else dialog.querySelector('button')?.focus();
}
function closeDialog() {
  if (dialog.dataset.busy === 'true') { toast('Đang xử lý yêu cầu, vui lòng chờ một chút.'); return; }
  dialog.close(); dialog.innerHTML = ''; state.dialogMode = ''; state.dialogBooking = null; state.dialogReturnFocus?.focus();
}
function showAuth(mode, pending = false) {
  state.pendingCheckout = pending || state.pendingCheckout; state.dialogMode = mode;
  if (state.user?.role === 'ADMIN') { openDialog('Dùng tài khoản khách hàng','Bạn đang đăng nhập bằng tài khoản quản lý.',`<p class="muted" style="font-size:13px">Để đặt sân như khách hàng, hãy đăng xuất rồi đăng nhập hoặc tạo một tài khoản khách riêng.</p>`,actionButton('Đăng xuất quản lý','logout','secondary')); return; }
  const register = mode === 'register';
  openDialog(register ? 'Hẹn trận đầu tiên' : 'Chào bạn trở lại',register ? 'Tạo tài khoản khách hàng để tự đặt và quản lý lịch chơi.' : 'Đăng nhập tài khoản khách hàng của bạn.',`${state.pendingCheckout ? '<div class="auth-notice">Lịch chơi bạn chọn vẫn được giữ trên giao diện. Đăng nhập xong, bạn có thể tiếp tục xác nhận.</div>' : ''}<form id="customer-${register ? 'register' : 'login'}-form"><div class="error-message" id="auth-error" role="alert"></div>${register ? '<div class="field"><label for="register-name">Họ và tên</label><input id="register-name" name="full_name" autocomplete="name" required minlength="2" maxlength="100" placeholder="Nguyễn Văn An"></div><div class="field-grid"><div class="field"><label for="register-phone">Số điện thoại</label><input id="register-phone" name="phone" type="tel" autocomplete="tel" pattern="(0[0-9]{9,10}|[+]84[0-9]{9,10})" required maxlength="20" placeholder="09xxxxxxxx"></div><div class="field"><label for="register-email">Email (tùy chọn)</label><input id="register-email" name="email" type="email" autocomplete="email" maxlength="150" placeholder="ban@example.com"></div></div>' : ''}<div class="field"><label for="auth-username">Tên đăng nhập</label><input id="auth-username" name="username" autocomplete="username" required maxlength="50" placeholder="${register ? 'Chọn tên đăng nhập' : 'Tên đăng nhập của bạn'}">${register ? '<p class="field-hint">Không được để trống hoặc trùng tài khoản đã có; tối đa 50 ký tự. Có thể dùng tiếng Việt và khoảng trắng giữa tên.</p>' : ''}</div><div class="field"><label for="auth-password">Mật khẩu</label><input id="auth-password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" required ${register ? 'minlength="8" maxlength="72"' : 'maxlength="100"'}>${register ? '<p class="field-hint">Ít nhất 8 ký tự, tối đa 72 byte UTF-8; bắt buộc có chữ hoa, chữ số và ký tự đặc biệt (ví dụ !, @, #). Khoảng trắng không tính là ký tự đặc biệt.</p>' : ''}</div>${register ? '<div class="field"><label for="auth-confirm">Nhập lại mật khẩu</label><input id="auth-confirm" name="password_confirm" type="password" autocomplete="new-password" required minlength="8" maxlength="72"></div>' : ''}<button class="btn full" type="submit">${register ? 'Tạo tài khoản' : 'Đăng nhập'} ${icon('arrow')}</button></form><p class="auth-switch">${register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <button type="button" class="text-btn" data-action="${register ? 'open-login' : 'open-register'}">${register ? 'Đăng nhập' : 'Đăng ký miễn phí'}</button></p>`);
}
function showCheckout() {
  const slots = selectedSlots(); const court = selectedCourt();
  if (!slots.length || !court) { state.pendingCheckout = false; toast('Chọn sân và khung giờ trước khi tiếp tục.',true); return; }
  if (!customerLoggedIn()) { showAuth('login',true); return; }
  state.pendingCheckout = false; state.dialogMode = 'checkout';
  openDialog('Xác nhận lịch chơi','Kiểm tra thông tin trước khi giữ chỗ.',`<form id="checkout-form"><div class="error-message" id="checkout-error" role="alert"></div><div class="checkout-summary"><h3>${esc(court.name)}</h3><p>${dateLabel(state.date)} · ${time(slots[0].start_time)} – ${time(slots[slots.length-1].end_time)} · ${slots.length} giờ</p><div class="price-line"><span>${money(court.hourly_price)} × ${slots.length} giờ</span></div><div class="total-line"><span>Tổng thanh toán</span><strong>${money(Number(court.hourly_price)*slots.length)}</strong></div></div><div class="checkout-person">Người đặt: <strong>${esc(state.user.display_name)}</strong><br>Đơn được lưu vào tài khoản <strong>${esc(state.user.username)}</strong> của bạn.</div><div class="field"><label for="booking-note">Ghi chú (không bắt buộc)</label><textarea id="booking-note" name="note" maxlength="500" placeholder="Ghi chú cho quản lý sân…"></textarea></div><div class="policy"><strong>Thanh toán tại sân</strong>Giờ sân được giữ sau khi đặt thành công. Có thể tự hủy trước giờ bắt đầu nếu đơn chưa thanh toán. Bạn vui lòng đến đúng giờ đã đặt.</div></form>`,`${actionButton('Quay lại','close-dialog','secondary')}<button class="btn" type="submit" form="checkout-form">Xác nhận đặt sân</button>`);
}
function renderDetail(b, created = false) {
  state.dialogMode = 'detail'; state.dialogBooking = b;
  openDialog(created ? 'Đặt sân thành công!' : 'Chi tiết đơn đặt sân',b.booking_code,`${created ? '<div class="success-message">Giờ chơi đã được giữ cho bạn. Bạn có thể theo dõi đơn trong mục Đơn của tôi.</div>' : ''}<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">${badge(b.status)}${paymentBadge(b)}</div><dl class="detail-grid"><div><dt>Sân</dt><dd>${esc(b.court_name)}</dd></div><div><dt>Ngày chơi</dt><dd>${dateLabel(b.play_date)}</dd></div><div><dt>Giờ chơi</dt><dd>${time(b.start_time)} – ${time(b.end_time)} · ${Number(b.slot_count)} giờ</dd></div><div><dt>Ngày đặt</dt><dd>${datetimeLabel(b.created_at)}</dd></div><div><dt>Người đặt</dt><dd>${esc(b.customer_name)}</dd></div><div><dt>Số điện thoại</dt><dd>${esc(b.customer_phone)}</dd></div></dl><div aria-label="Chi tiết giá từng giờ">${(b.items || []).map(item => `<div class="detail-slot"><span>${time(item.start_time)} – ${time(item.end_time)}</span><strong>${money(item.unit_price)}</strong></div>`).join('')}</div><div class="total-line"><span>Tổng tiền đơn</span><strong>${money(b.total_amount)}</strong></div>${b.note ? `<div class="note-box"><strong>Ghi chú</strong><br>${esc(b.note)}</div>` : ''}${b.payment ? `<div class="policy"><strong>Đã thanh toán ${money(b.payment.amount)}</strong>${b.payment.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'} · ${datetimeLabel(b.payment.paid_at)}</div>` : b.status === 'CANCELLED' ? `<div class="note-box">Đơn đã hủy${b.cancelled_at ? ' lúc '+datetimeLabel(b.cancelled_at) : ''}. Các khung giờ đã được mở lại.</div>` : '<div class="policy"><strong>Thanh toán tại sân</strong>Bạn thanh toán trực tiếp với quản lý. Trạng thái thanh toán sẽ được cập nhật ở đây.</div>'}${b.can_cancel ? '<p class="field-hint" style="margin-top:17px">Bạn có thể hủy đơn này trước giờ bắt đầu vì đơn chưa thanh toán.</p>' : b.status === 'CONFIRMED' ? '<p class="field-hint" style="margin-top:17px">Đơn đã thanh toán hoặc đã đến giờ chơi nên không thể tự hủy. Vui lòng trao đổi với quản lý sân nếu cần hỗ trợ.</p>' : ''}`,`${b.can_cancel ? actionButton('Hủy đơn','cancel-booking','danger',`data-id="${esc(b.id)}"`) : ''}${created ? '<a href="#don-cua-toi" class="btn" data-action="go-history">Xem đơn của tôi</a>' : actionButton('Đóng','close-dialog','secondary')}`);
}
async function showDetail(id) {
  state.dialogMode = 'loading'; openDialog('Chi tiết đơn đặt sân','Đang lấy thông tin mới nhất…',busyMarkup);
  try { const booking = await api(`/api/customer/bookings/${id}`); if (dialog.open && state.dialogMode === 'loading') renderDetail(booking); }
  catch (error) { if (dialog.open && state.dialogMode === 'loading') openDialog('Chưa tải được đơn','',`<p class="error-message" role="alert">${esc(error.message)}</p>`,actionButton('Đóng','close-dialog','secondary')); }
}
function showCancel() {
  const b = state.dialogBooking; if (!b?.can_cancel) return; state.dialogMode = 'cancel';
  openDialog('Hủy lịch chơi này?','Các khung giờ sẽ được mở lại ngay sau khi hủy.',`<form id="cancel-form" data-id="${esc(b.id)}"><div class="error-message" id="cancel-error" role="alert"></div><div class="checkout-summary"><h3>${esc(b.court_name)}</h3><p>${dateLabel(b.play_date)} · ${time(b.start_time)} – ${time(b.end_time)}</p><strong>${esc(b.booking_code)}</strong></div><p class="muted" style="font-size:13px">Bạn có thể tạo đơn mới nếu muốn đổi ngày hoặc giờ chơi.</p></form>`,`${actionButton('Giữ lịch chơi','back-detail','secondary')}<button class="btn danger" type="submit" form="cancel-form">Xác nhận hủy đơn</button>`);
}
async function logout() {
  if (dialog.dataset.busy === 'true') return;
  try { await api('/api/auth/logout',{method:'POST'}); closeDialog(); await refreshSession(); state.pendingCheckout = false; state.profile = null; state.bookings = []; toast('Đã đăng xuất.'); await loadPage(); }
  catch (error) { toast(error.message,true); }
}
function normalizeUsername(value) {
  const username = value.trim();
  if (!username || username.length > 50) throw new Error('Tên đăng nhập không được để trống và tối đa 50 ký tự.');
  return username;
}
function validateNewPassword(value, confirm) {
  if (value !== confirm) throw new Error('Mật khẩu nhập lại chưa khớp.');
  if (value.length < 8 || new TextEncoder().encode(value).length > 72) throw new Error('Mật khẩu cần ít nhất 8 ký tự và không quá 72 byte UTF-8.');
  if (!/\p{Lu}/u.test(value)) throw new Error('Mật khẩu cần có ít nhất một chữ hoa.');
  if (!/\p{Nd}/u.test(value)) throw new Error('Mật khẩu cần có ít nhất một chữ số.');
  if (!/[\p{P}\p{S}]/u.test(value)) throw new Error('Mật khẩu cần có ít nhất một ký tự đặc biệt (ví dụ !, @, #). Khoảng trắng không được tính.');
}
async function afterAuthentication() {
  const session = await refreshSession();
  if (!session.authenticated) throw new Error('Phiên đăng nhập chưa được tạo. Vui lòng thử lại.');
  if (!customerLoggedIn()) { location.assign('/quan-ly/'); return; }
  dialog.dataset.busy = 'false'; closeDialog(); toast('Chào bạn, '+state.user.display_name+'!');
  const continueCheckout = state.pendingCheckout;
  await loadPage();
  if (continueCheckout && state.route === 'dat-san' && selectedSlots().length) showCheckout();
  else state.pendingCheckout = false;
}
document.addEventListener('click',async event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (dialog.open && dialog.dataset.busy === 'true') { event.preventDefault(); return; }
  if (action === 'go-history') { closeDialog(); if (state.route === 'don-cua-toi') await loadPage(); return; }
  try {
    switch (action) {
      case 'open-login': showAuth('login'); break;
      case 'open-register': showAuth('register'); break;
      case 'close-dialog': closeDialog(); break;
      case 'logout': await logout(); break;
      case 'reload': await loadPage(); break;
      case 'retry-boot': await boot(); break;
      case 'choose-court': state.courtId = Number(button.dataset.id); state.slotIds = []; renderBooking(); break;
      case 'choose-slot': chooseSlot(Number(button.dataset.id)); break;
      case 'clear-selection': state.slotIds = []; renderBooking(); break;
      case 'checkout': showCheckout(); break;
      case 'filter-bookings': state.filter = button.dataset.status; await loadPage(); break;
      case 'detail': await showDetail(Number(button.dataset.id)); break;
      case 'cancel-booking': showCancel(); break;
      case 'back-detail': renderDetail(state.dialogBooking); break;
    }
  } catch (error) { toast(error.message,true); }
});
document.addEventListener('change',async event => {
  if (event.target.id !== 'play-date') return;
  const value = event.target.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < state.config.today || value > state.config.max_booking_date) { event.target.value = state.date; toast('Chọn ngày từ hôm nay đến tối đa 30 ngày tới.',true); return; }
  state.date = value; state.slotIds = []; await loadPage();
});
document.addEventListener('submit',async event => {
  const form = event.target; if (!['customer-login-form','customer-register-form','checkout-form','cancel-form','profile-form','password-form'].includes(form.id)) return;
  event.preventDefault(); if (form.dataset.busy === 'true') return;
  form.dataset.busy = 'true';
  const fields = Object.fromEntries(new FormData(form));
  const submit = event.submitter || document.querySelector(`[form="${form.id}"][type="submit"]`) || form.querySelector('[type="submit"]');
  const errorTarget = form.querySelector('.error-message'); if (errorTarget) errorTarget.textContent = '';
  if (submit) { submit.disabled = true; submit.setAttribute('aria-busy','true'); }
  const inDialog = dialog.contains(form); if (inDialog) dialog.dataset.busy = 'true';
  try {
    switch (form.id) {
      case 'customer-login-form': {
        const username = normalizeUsername(fields.username);
        await refreshSession();
        await api('/api/auth/login',{method:'POST',body:{username,password:fields.password}});
        await afterAuthentication(); break;
      }
      case 'customer-register-form': {
        validateNewPassword(fields.password,fields.password_confirm);
        const username = normalizeUsername(fields.username);
        await refreshSession();
        await api('/api/auth/register',{method:'POST',body:{username,password:fields.password,full_name:fields.full_name.trim(),phone:fields.phone.trim(),email:fields.email.trim() || null}});
        await afterAuthentication(); break;
      }
      case 'checkout-form': {
        const slots = selectedSlots(); if (!slots.length) throw new Error('Lịch đã chọn không còn hợp lệ. Vui lòng chọn lại.');
        const booking = await api('/api/customer/bookings',{method:'POST',body:{court_id:Number(state.courtId),play_date:state.date,slot_ids:slots.map(s => Number(s.time_slot_id)),note:fields.note.trim()}});
        state.slotIds = []; state.pendingCheckout = false; dialog.dataset.busy = 'false'; renderDetail(booking,true);
        if (state.route === 'dat-san') loadPage(); break;
      }
      case 'cancel-form': {
        const booking = await api(`/api/customer/bookings/${Number(form.dataset.id)}/cancel`,{method:'POST'});
        dialog.dataset.busy = 'false'; toast('Đã hủy đơn. Các khung giờ đã được mở lại.'); renderDetail(booking);
        loadPage(); break;
      }
      case 'profile-form': {
        const profile = await api('/api/customer/me',{method:'PUT',body:{full_name:fields.full_name.trim(),phone:fields.phone.trim(),email:fields.email.trim() || null}});
        state.profile = profile; await refreshSession(); renderHeader(); toast('Đã lưu thông tin cá nhân.'); break;
      }
      case 'password-form': {
        validateNewPassword(fields.new_password,fields.new_password_confirm);
        if (fields.current_password === fields.new_password) throw new Error('Mật khẩu mới cần khác mật khẩu hiện tại.');
        await api('/api/customer/password',{method:'PUT',body:{current_password:fields.current_password,new_password:fields.new_password}});
        await refreshSession(); form.reset(); toast('Đã đổi mật khẩu. Lần đăng nhập sau, hãy dùng mật khẩu mới.'); break;
      }
    }
  } catch (error) {
    if (errorTarget?.isConnected) { errorTarget.textContent = error.message; errorTarget.setAttribute('tabindex','-1'); errorTarget.focus(); }
    else toast(error.message,true);
  } finally {
    form.dataset.busy = 'false'; if (inDialog) dialog.dataset.busy = 'false';
    if (submit) { submit.disabled = false; submit.removeAttribute('aria-busy'); }
  }
});
dialog.addEventListener('cancel',event => { if (dialog.dataset.busy === 'true') event.preventDefault(); else { event.preventDefault(); closeDialog(); } });
dialog.addEventListener('click',event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog(); } });
window.addEventListener('hashchange',() => { if (dialog.dataset.busy !== 'true') closeDialog(); loadPage(); });
async function boot() {
  try {
    const [,config,courts] = await Promise.all([refreshSession(),api('/api/customer/config'),api('/api/customer/courts')]);
    state.config = config; state.courts = courts; state.date = state.date || config.today; state.route = getRoute();
    shell(); await loadPage();
  } catch (error) { app.innerHTML = `<main class="boot"><div class="panel">${empty('Chưa thể mở Courtly',error.message,actionButton('Kết nối lại','retry-boot','secondary'),'refresh')}</div></main>`; }
}
boot();
