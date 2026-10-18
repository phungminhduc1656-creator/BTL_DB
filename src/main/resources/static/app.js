'use strict';

const icons = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
  list:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  court:'<rect x="5" y="2" width="14" height="20" rx="1"/><path d="M5 12h14M12 2v20M5 7h14M5 17h14"/>',
  chart:'<path d="M3 3v18h18M7 16v-5M12 16V6M17 16V9"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  money:'<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  edit:'<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5M4 17v4h16v-4"/>',
  wallet:'<path d="M21 8V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v10H5a3 3 0 0 1-3-3V7M21 12h-5v4h5"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  warning:'<path d="m12 3 10 18H2zM12 9v4M12 17h.01"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6a8 8 0 0 1 13.4 3M4.5 15a8 8 0 0 0 13.4 3"/>',
  transfer:'<path d="M3 7h17M16 3l4 4-4 4M21 17H4M8 13l-4 4 4 4"/>',
  eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.court}</svg>`;
const courtArt = (klass = 'court-art') => `<svg class="${klass}" viewBox="0 0 220 290" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="26" y="16" width="168" height="256" rx="3" fill="currentColor" opacity=".15"/><rect x="35" y="27" width="150" height="234" stroke="currentColor" stroke-width="2.5"/><path d="M35 144h150M35 101h150M35 186h150M110 27v74M110 186v75" stroke="currentColor" stroke-width="2.5"/><path d="M26 144h168" stroke="currentColor" stroke-width="6"/><circle class="ball" cx="157" cy="217" r="17" stroke-width="1.2"/><circle cx="151" cy="211" r="2" fill="currentColor"/><circle cx="163" cy="214" r="2" fill="currentColor"/><circle cx="156" cy="224" r="2" fill="currentColor"/></svg>`;
const brand = `<div class="brand"><svg class="brand-icon" viewBox="0 0 34 44" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="2" y="2" width="30" height="40" rx="2"/><path d="M2 22h30M2 14h30M2 30h30M17 2v12M17 30v12"/></svg>Courtly<span style="color:var(--lime)">.</span></div>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('vi-VN', {style:'currency', currency:'VND', maximumFractionDigits:0}).format(Number(value) || 0);
const shortMoney = value => Number(value) >= 1000000 ? `${(Number(value)/1000000).toLocaleString('vi-VN',{maximumFractionDigits:1})}tr` : `${Math.round(Number(value)/1000).toLocaleString('vi-VN')}k`;
const time = value => String(value || '').slice(0,5);
const fmtDate = value => { const date = String(value || '').slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : '—'; };
const fmtDateTime = value => value ? `${time(String(value).slice(11))} · ${fmtDate(value)}` : '—';
const pages = [
  {id:'dashboard',name:'Tổng quan',icon:'grid'}, {id:'booking',name:'Lịch sân & đặt sân',icon:'calendar'},
  {id:'bookings',name:'Đơn đặt sân',icon:'list'}, {id:'customers',name:'Khách hàng',icon:'users'},
  {id:'courts',name:'Quản lý sân',icon:'court'}, {id:'reports',name:'Thống kê',icon:'chart'}
];
const state = {
  user:null, csrf:'', config:null, page:'dashboard', data:null, pageRequest:0,
  bookingDate:'', selectedCourt:null, selectedSlots:[], bookingFilters:{date:'',status:'',q:''},
  customerQuery:'', reportFrom:'', reportTo:'', modal:null, modalReturnFocus:null, selectedCustomer:null
};
const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
let customerSearchTimer;

async function api(path, options = {}) {
  const {method = 'GET', body, ...other} = options;
  const headers = {'Accept':'application/json'};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && state.csrf) headers['X-CSRF-TOKEN'] = state.csrf;
  let response;
  try { response = await fetch(path, {method, credentials:'same-origin', headers, ...(body !== undefined ? {body:JSON.stringify(body)} : {}), ...other}); }
  catch { throw new Error('Không kết nối được với máy chủ. Kiểm tra ứng dụng đang chạy và thử lại.'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại.'); }
  if (!response.ok) {
    if (response.status === 401 && state.user && !path.includes('/api/auth/')) {
      state.user = null; closeModal(); renderLogin('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
    throw new Error(result.message || `Không thể xử lý yêu cầu (${response.status}).`);
  }
  return result.data;
}
function toast(message, error = false) {
  const element = document.createElement('div'); element.className = `toast${error ? ' error' : ''}`;
  element.innerHTML = `${icon(error ? 'warning' : 'check')}<span>${esc(message)}</span>`;
  const stack = document.getElementById('toast-root');
  while (stack.children.length >= 3) stack.firstElementChild.remove();
  stack.append(element);
  setTimeout(() => element.remove(), error ? 6500 : 4200);
}
function bookingBadge(status) {
  const values = {CONFIRMED:['green','Đã xác nhận'],CANCELLED:['red','Đã hủy'],COMPLETED:['blue','Hoàn thành']};
  const [color,label] = values[status] || ['grey',status || '—'];
  return `<span class="badge ${color}">${esc(label)}</span>`;
}
function paymentBadge(status) { return `<span class="badge ${status === 'PAID' ? 'green' : 'amber'}">${status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</span>`; }
function courtBadge(status) { const [color,label] = {ACTIVE:['green','Đang hoạt động'],MAINTENANCE:['amber','Bảo trì'],INACTIVE:['grey','Ngừng hoạt động']}[status] || ['grey',status]; return `<span class="badge ${color}">${esc(label)}</span>`; }
function title(eyebrow,heading,description,action = '') { return `<div class="page-title"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(heading)}</h1><p>${esc(description)}</p></div>${action}</div>`; }
function empty(heading,description,action = '',symbol = 'list') { return `<div class="empty-state"><div class="empty-icon">${icon(symbol)}</div><h3>${esc(heading)}</h3><p>${esc(description)}</p>${action}</div>`; }
function button(label,action,symbol = '',classes = '',attrs = '') { return `<button class="btn ${classes}" data-action="${action}" ${attrs}>${symbol ? icon(symbol) : ''}${esc(label)}</button>`; }
function setContent(html) { const content = document.getElementById('page-content'); if (content) content.innerHTML = html; }
function getPage() { const route = location.hash.replace('#',''); return pages.some(p => p.id === route) ? route : 'dashboard'; }
function navigate(page) { closeMobileNav(); if (state.page === page && location.hash === `#${page}`) loadPage(); else location.hash = page; }
function closeMobileNav() { document.querySelector('.sidebar')?.classList.remove('open'); document.querySelector('.mobile-overlay')?.classList.remove('open'); }

function renderLogin(error = '') {
  app.innerHTML = `<div class="login-screen"><aside class="login-art">${brand}<div class="login-art-copy"><div class="eyebrow">PICKLEBALL COURT MANAGEMENT</div><h1>Mọi trận đấu hay<br>bắt đầu từ một<br><span>lịch sân gọn gàng.</span></h1><p>Quản lý lịch sân, khách hàng và doanh thu trong cùng một không gian.</p></div>${courtArt()}<div class="login-art-footer">COURTLY · HỆ THỐNG QUẢN LÝ ĐẶT SÂN PICKLEBALL</div></aside><main class="login-main"><div class="login-form-wrap"><div class="eyebrow">CHÀO MỪNG TRỞ LẠI</div><h2>Đăng nhập quản lý</h2><p>Mở một ngày làm việc mới.<br>Lịch sân của bạn đang chờ.</p><form id="login-form"><div class="form-error" id="login-error" role="alert">${esc(error)}</div><div class="field"><label for="username">Tên đăng nhập</label><input id="username" name="username" autocomplete="username" placeholder="Nhập tên đăng nhập" required maxlength="100"></div><div class="field"><label for="password">Mật khẩu</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu" required maxlength="128"></div><button class="btn" type="submit">Đăng nhập ${icon('arrow')}</button></form><p style="font-size:13px;margin:22px 0 0"><a href="/khach-hang/" style="color:var(--forest);text-decoration:underline;text-underline-offset:4px">Bạn muốn đặt sân? Mở trang khách hàng →</a></p><div class="demo-hint">Tài khoản demo: <strong>admin</strong><br>Mật khẩu: <strong>admin123</strong></div></div></main></div>`;
  document.getElementById('username')?.focus();
}
function renderShell() {
  const page = pages.find(p => p.id === state.page);
  app.innerHTML = `<div class="shell"><div class="mobile-overlay" data-action="close-nav"></div><aside class="sidebar">${brand}<div class="brand-sub">Pickleball management</div><div class="nav-label">KHÔNG GIAN QUẢN LÝ</div><nav aria-label="Điều hướng chính">${pages.map(p => `<a class="nav-link ${p.id === state.page ? 'active' : ''}" href="#${p.id}" ${p.id === state.page ? 'aria-current="page"' : ''}>${icon(p.icon)}${p.name}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-note">${icon('court')}<strong>Mỗi giờ sân, một cơ hội.</strong><p>Đặt sân theo khung giờ cố định.<br>Rõ lịch. Gọn việc. Vui chơi.</p></div><div class="profile"><div class="avatar">${esc((state.user.display_name || 'A').charAt(0).toUpperCase())}</div><div><div class="profile-name">${esc(state.user.display_name || state.user.username)}</div><div class="small">QUẢN TRỊ VIÊN</div></div><button class="logout" data-action="logout" aria-label="Đăng xuất" title="Đăng xuất">${icon('logout')}</button></div></div></aside><header class="topbar"><div class="breadcrumb"><button class="menu-button" data-action="menu" aria-label="Mở menu">${icon('menu')}</button><span>Không gian quản lý</span><span>/</span><strong>${esc(page.name)}</strong></div><div class="topbar-right"><a class="panel-link" href="/khach-hang/">Trang khách hàng</a><div class="today-chip">${icon('calendar')}${fmtDate(state.config.today)}</div><div class="live-chip"><span class="status-dot"></span>HỆ THỐNG ĐANG CHẠY</div></div></header><main class="content" id="page-content" tabindex="-1"></main></div>`;
}
async function startAuthenticated() {
  if (state.user?.role === 'CUSTOMER') { location.replace('/khach-hang/'); return; }
  state.config = await api('/api/config');
  state.bookingDate ||= state.config.today;
  state.reportFrom ||= `${state.config.today.slice(0,7)}-01`;
  state.reportTo ||= state.config.today;
  await loadPage();
}
async function loadPage() {
  if (!state.user) return;
  state.page = getPage(); renderShell();
  const request = ++state.pageRequest;
  setContent('<div class="page-loading" role="status"><span class="spinner"></span>Đang tải dữ liệu…</div>');
  const queries = {
    dashboard:`/api/dashboard?date=${encodeURIComponent(state.config.today)}`,
    booking:`/api/availability?date=${encodeURIComponent(state.bookingDate)}`,
    bookings:`/api/bookings?${new URLSearchParams(state.bookingFilters)}`,
    customers:`/api/customers?q=${encodeURIComponent(state.customerQuery)}`,
    courts:'/api/courts', reports:`/api/reports?${new URLSearchParams({from:state.reportFrom,to:state.reportTo})}`
  };
  try {
    const data = await api(queries[state.page]);
    if (request !== state.pageRequest || !state.user) return;
    state.data = data;
    const render = {dashboard:renderDashboard,booking:renderBooking,bookings:renderBookings,customers:renderCustomers,courts:renderCourts,reports:renderReports};
    setContent(render[state.page](data));
  } catch (error) {
    if (request !== state.pageRequest || !state.user) return;
    setContent(`<div class="error-state">${icon('warning')}<h3>Chưa tải được dữ liệu</h3><p>${esc(error.message)}</p>${button('Thử lại','reload','refresh','secondary')}</div>`);
  }
}
function renderDashboard(data) {
  const utilization = data.court_utilization || [];
  const totalCourtSlots = utilization.reduce((total,court) => total+Number(court.total_slots || 0),0);
  const bookedCourtSlots = utilization.reduce((total,court) => total+Number(court.booked_slots || 0),0);
  const occupancy = totalCourtSlots ? Math.round(bookedCourtSlots/totalCourtSlots*100) : 0;
  return `${title('HÔM NAY TẠI SÂN','Sẵn sàng cho một ngày mới.',`Tình hình hoạt động ngày ${fmtDate(data.date)}.`,button('Tạo đơn đặt sân','go-booking','plus'))}<div class="cards"><div class="stat-card hero"><div class="stat-top">Doanh thu đã thu ${icon('money')}</div><div class="stat-value money">${money(data.paid_revenue)}</div><div class="stat-foot">Tiền thanh toán ghi nhận trong hôm nay</div></div><div class="stat-card"><div class="stat-top">Đơn đặt hôm nay ${icon('list')}</div><div class="stat-value">${esc(data.booking_count)}</div><div class="stat-foot">Lượt đặt theo ngày chơi</div></div><div class="stat-card"><div class="stat-top">Khung giờ còn trống ${icon('clock')}</div><div class="stat-value">${esc(data.available_slot_count)} <span class="muted" style="font-size:15px;font-weight:400">/ ${esc(data.total_slot_count)}</span></div><div class="stat-foot">Có thể đặt cho hôm nay</div></div><div class="stat-card"><div class="stat-top">Tổng khách hàng ${icon('users')}</div><div class="stat-value">${esc(data.customer_count)}</div><div class="stat-foot">Chưa thu hôm nay: ${money(data.unpaid_total)}</div></div></div><div class="dashboard-grid"><div class="welcome-panel"><div class="welcome-copy"><div class="eyebrow">HẸN NHAU TRÊN SÂN</div><h2>Lịch rõ ràng.<br>Trận đấu trọn vẹn.</h2><p>Chọn sân, chọn giờ và xác nhận đặt chỗ. Sắp xếp buổi chơi tiếp theo chỉ trong vài bước.</p>${button('Xem lịch sân','go-booking','arrow','secondary sm')}</div>${courtArt()}</div><div class="panel"><div class="panel-head"><h2>Mức sử dụng sân</h2><span class="small muted">Hôm nay</span></div><div class="panel-body"><div class="occupancy"><div class="occupancy-number">${occupancy}%</div><div class="occupancy-label">Khung giờ đã có đơn đặt<br>trên các sân hoạt động</div></div>${utilization.length ? utilization.map(c => `<div class="court-util"><div class="court-util-row"><span>${esc(c.name)}</span><span>${esc(c.booked_slots)} / ${esc(c.total_slots)} giờ</span></div><div class="progress-track"><span style="width:${Math.min(100,Number(c.total_slots) ? Number(c.booked_slots)/Number(c.total_slots)*100 : 0)}%"></span></div></div>`).join('') : '<p class="small muted">Chưa có sân hoạt động.</p>'}</div></div></div><div class="panel"><div class="panel-head"><div><h2>Đơn đặt gần đây</h2><p>Những đơn mới nhất cho ngày hôm nay</p></div><a class="panel-link" href="#bookings">Tất cả đơn ${icon('arrow')}</a></div>${bookingTable(data.recent_bookings || [],true)}</div>${footer()}`;
}
function footer() { return '<div class="footer-note">Courtly · Quản lý sân pickleball · Khung giờ cố định 1 giờ</div>'; }
function bookingTable(bookings, compact = false) {
  if (!bookings.length) return empty('Chưa có đơn đặt sân','Các đơn phù hợp sẽ xuất hiện tại đây.',button('Đặt sân mới','go-booking','plus','secondary sm'));
  return `<div class="table-scroll"><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sân & lịch chơi</th><th>Thành tiền</th><th>Trạng thái</th>${compact ? '' : '<th>Thanh toán</th>'}<th></th></tr></thead><tbody>${bookings.map(b => `<tr><td><strong>${esc(b.booking_code)}</strong><div class="subline">${fmtDateTime(b.created_at)}</div></td><td><strong>${esc(b.customer_name)}</strong><div class="subline">${esc(b.customer_phone)}</div></td><td><strong>${esc(b.court_name)}</strong><div class="subline nowrap">${fmtDate(b.play_date)} · ${time(b.start_time)}–${time(b.end_time)}</div></td><td class="nowrap mono">${money(b.total_amount)}</td><td>${bookingBadge(b.status)}</td>${compact ? '' : `<td>${paymentBadge(b.payment_status)}</td>`}<td><button class="icon-button" data-action="booking-detail" data-id="${esc(b.id)}" title="Xem chi tiết đơn ${esc(b.booking_code)}" aria-label="Xem chi tiết đơn ${esc(b.booking_code)}">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>`;
}
function renderBooking(data) {
  const selectedCourt = data.courts.find(c => Number(c.id) === Number(state.selectedCourt));
  if (!selectedCourt) { state.selectedCourt = null; state.selectedSlots = []; }
  else state.selectedSlots = state.selectedSlots.filter(id => selectedCourt.slots.some(s => s.available && Number(s.time_slot_id) === Number(id)));
  const timeSlots = data.time_slots || state.config.time_slots;
  return `${title('CHỌN GIỜ · GIỮ SÂN','Lịch sân & đặt sân','Chọn các khung giờ liên tiếp trên cùng một sân. Mỗi khung giờ dài 1 giờ.')}<div class="booking-layout"><div><div class="panel booking-board"><div class="panel-head"><div><h2>Lịch sân ngày ${fmtDate(data.date)}</h2><p>${esc(data.courts.filter(c => c.status === 'ACTIVE').length)} sân đang hoạt động · 06:00–23:00</p></div><div><label class="small" for="booking-date">Ngày chơi</label><input class="date-control" id="booking-date" type="date" value="${esc(state.bookingDate)}" min="${esc(state.config.today)}" max="${esc(state.config.max_booking_date)}" required></div></div><div class="legend"><span class="legend-item"><span class="legend-swatch"></span>Còn trống</span><span class="legend-item"><span class="legend-swatch selected"></span>Đang chọn</span><span class="legend-item"><span class="legend-swatch booked"></span>Đã đặt</span><span class="legend-item"><span class="legend-swatch unavailable"></span>Không khả dụng</span></div>${data.courts.length ? `<div class="schedule-scroll"><div class="schedule" style="grid-template-columns:120px repeat(${timeSlots.length},64px)"><div></div>${timeSlots.map(s => `<div class="schedule-time">${time(s.start_time)}<span>${time(s.end_time)}</span></div>`).join('')}${data.courts.map(c => `<div class="court-label"><strong title="${esc(c.name)}">${esc(c.name)}</strong><span>${money(c.hourly_price)}/giờ</span></div>${c.slots.map(s => { const selected = Number(c.id) === Number(state.selectedCourt) && state.selectedSlots.includes(Number(s.time_slot_id)); const booked = s.reason === 'BOOKED'; const description = selected ? 'Đang chọn' : s.available ? 'Còn trống' : booked ? 'Đã đặt' : s.reason === 'PAST' ? 'Đã qua giờ' : 'Không khả dụng'; return `<button class="slot ${selected ? 'selected' : s.available ? '' : booked ? 'booked' : 'unavailable'}" data-action="select-slot" data-court="${esc(c.id)}" data-slot="${esc(s.time_slot_id)}" ${s.available ? '' : 'disabled'} aria-pressed="${selected}" aria-label="${esc(c.name)}, ${time(s.start_time)} đến ${time(s.end_time)}, ${description}" title="${description}">${icon(selected ? 'check' : booked ? 'list' : s.available ? 'plus' : 'close')}<span>${selected ? 'Đã chọn' : s.available ? 'Trống' : booked ? 'Đã đặt' : '—'}</span></button>`; }).join('')}`).join('')}</div></div>` : empty('Chưa có sân','Thêm sân đầu tiên để bắt đầu quản lý lịch.',button('Thêm sân','go-courts','plus','secondary sm'),'court')}<div class="schedule-footer">Có thể đặt từ hôm nay đến ${fmtDate(state.config.max_booking_date)}. Khung giờ đã bắt đầu và sân bảo trì không nhận đặt mới.</div></div><div class="tip"><strong>Cách đặt nhiều giờ</strong>Chọn 2 ô liên tiếp để đặt 2 giờ, ví dụ 18:00–19:00 và 19:00–20:00. Nếu chuyển sang sân khác, lựa chọn hiện tại sẽ được thay bằng sân mới.</div></div><aside class="panel selection-panel"><div class="panel-body"><div class="selection-title">LỊCH CHƠI CỦA BẠN</div>${selectionSummary(data)}</div></aside></div>${footer()}`;
}
function selectedInfo() {
  const court = state.data?.courts?.find(c => Number(c.id) === Number(state.selectedCourt));
  const slots = court ? court.slots.filter(s => state.selectedSlots.includes(Number(s.time_slot_id))).sort((a,b) => a.start_time.localeCompare(b.start_time)) : [];
  return {court,slots,total:Number(court?.hourly_price || 0)*slots.length};
}
function selectionSummary() {
  const {court,slots,total} = selectedInfo();
  if (!court || !slots.length) return `<div class="selection-empty">${icon('court')}Một lịch chơi đang chờ bạn.<br>Chọn các ô trống trên lịch sân.</div>`;
  return `<h2 class="selection-court">${esc(court.name)}</h2><div class="selection-date">${fmtDate(state.bookingDate)}</div><div class="selected-slots">${slots.map(s => `<span>${time(s.start_time)}–${time(s.end_time)}</span>`).join('')}</div><div class="price-row"><span>Giá thuê / giờ</span><span>${money(court.hourly_price)}</span></div><div class="price-row"><span>Thời lượng</span><span>${slots.length} giờ</span></div><div class="price-total"><span>Tổng tiền</span><strong>${money(total)}</strong></div>${button('Tiếp tục đặt sân','checkout','arrow')}${button('Bỏ lựa chọn','clear-selection','','secondary sm')}`;
}
function renderBookings(data) {
  const f = state.bookingFilters;
  return `${title('QUẢN LÝ GIAO DỊCH','Đơn đặt sân','Tra cứu lịch chơi, ghi nhận thanh toán và quản lý trạng thái đơn.',button('Tạo đơn mới','go-booking','plus'))}<form class="toolbar" id="booking-filter"><div class="search-box">${icon('search')}<input aria-label="Tìm đơn đặt sân" name="q" placeholder="Tìm mã đơn, tên hoặc số điện thoại…" value="${esc(f.q)}" maxlength="100"></div><input type="date" name="date" aria-label="Lọc theo ngày chơi" value="${esc(f.date)}"><select name="status" aria-label="Lọc trạng thái"><option value="">Tất cả trạng thái</option>${[['CONFIRMED','Đã xác nhận'],['COMPLETED','Hoàn thành'],['CANCELLED','Đã hủy']].map(([v,l]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn secondary" type="submit">Lọc</button><button class="icon-button" data-action="clear-booking-filter" type="button" title="Xóa bộ lọc" aria-label="Xóa bộ lọc">${icon('refresh')}</button><span class="count-note">${data.length} đơn đặt</span></form><div class="panel">${bookingTable(data)}</div>${footer()}`;
}
function renderCustomers(data) {
  return `${title('KẾT NỐI NGƯỜI CHƠI','Khách hàng','Thông tin liên hệ và lịch sử đặt sân của từng khách hàng.',button('Thêm khách hàng','new-customer','plus'))}<form class="toolbar" id="customer-filter"><div class="search-box">${icon('search')}<input name="q" aria-label="Tìm khách hàng" placeholder="Tìm tên, số điện thoại hoặc email…" maxlength="100" value="${esc(state.customerQuery)}"></div><button class="btn secondary" type="submit">Tìm kiếm</button><span class="count-note">${data.length} khách hàng</span></form><div class="panel">${data.length ? `<div class="table-scroll"><table><thead><tr><th>Khách hàng</th><th>Số điện thoại</th><th>Email</th><th>Lượt đặt</th><th>Thao tác</th></tr></thead><tbody>${data.map(c => `<tr><td><div style="display:flex;gap:12px;align-items:center"><div class="avatar" style="background:#edf3e4;color:#698348">${esc(c.full_name.charAt(0).toUpperCase())}</div><div><strong>${esc(c.full_name)}</strong><div class="subline">KH-${String(c.id).padStart(4,'0')}</div></div></div></td><td class="mono">${esc(c.phone)}</td><td>${esc(c.email || '—')}</td><td><span class="badge grey">${esc(c.booking_count || 0)} lượt</span></td><td><div class="table-actions"><button class="btn sm secondary" data-action="customer-history" data-id="${esc(c.id)}">${icon('clock')}Lịch sử</button><button class="icon-button" data-action="edit-customer" data-id="${esc(c.id)}" title="Sửa ${esc(c.full_name)}" aria-label="Sửa khách hàng ${esc(c.full_name)}">${icon('edit')}</button></div></td></tr>`).join('')}</tbody></table></div>` : empty('Chưa tìm thấy khách hàng','Thêm khách hàng mới hoặc thử một từ khóa khác.',button('Thêm khách hàng','new-customer','plus','secondary sm'),'users')}</div>${footer()}`;
}
function renderCourts(data) {
  return `${title('KHÔNG GIAN THI ĐẤU','Quản lý sân','Thiết lập giá thuê và tình trạng hoạt động của từng sân.',button('Thêm sân mới','new-court','plus'))}${data.length ? `<div class="court-cards">${data.map(c => `<article class="court-card"><div class="court-card-top">${courtArt('')}${courtBadge(c.status)}</div><div class="court-card-info"><div class="court-code">${esc(c.code)}</div><div class="court-card-title"><h3>${esc(c.name)}</h3><button class="icon-button" data-action="edit-court" data-id="${esc(c.id)}" title="Sửa ${esc(c.name)}" aria-label="Sửa sân ${esc(c.name)}">${icon('edit')}</button></div><p>${esc(c.description || 'Sân pickleball tiêu chuẩn. Sẵn sàng cho buổi chơi tiếp theo.')}</p><div class="court-card-price"><span>Giá thuê mỗi giờ</span><strong>${money(c.hourly_price)}</strong></div></div></article>`).join('')}</div>` : `<div class="panel">${empty('Chưa có sân nào','Tạo sân và giá thuê để bắt đầu nhận đơn đặt.',button('Thêm sân','new-court','plus','secondary'),'court')}</div>`}<div class="tip"><strong>Giá thuê được lưu theo từng đơn</strong>Đổi giá sân chỉ ảnh hưởng đơn đặt mới. Chỉ chuyển sang bảo trì hoặc ngừng hoạt động sau khi đã xử lý các lịch đặt chưa kết thúc.</div>${footer()}`;
}
function renderReports(data) {
  const daily = data.by_day || [];
  const maximum = Math.max(1,...daily.map(d => Number(d.paid_revenue)));
  const chartWidth = Math.max(0,daily.length*35);
  return `${title('NHÌN LẠI HOẠT ĐỘNG','Thống kê & doanh thu','Theo dõi lịch chơi và số tiền đã thu trong khoảng thời gian lựa chọn.',`<a class="btn secondary" href="/api/reports/export?${new URLSearchParams({from:state.reportFrom,to:state.reportTo})}" download>${icon('download')}Xuất CSV</a>`)}<form class="toolbar report-toolbar" id="report-filter"><div class="field"><label for="report-from">Từ ngày</label><input id="report-from" name="from" type="date" value="${esc(state.reportFrom)}" required></div><div class="field"><label for="report-to">Đến ngày</label><input id="report-to" name="to" type="date" value="${esc(state.reportTo)}" required></div><button class="btn secondary" type="submit" style="align-self:flex-end">Xem thống kê</button><span class="count-note">${fmtDate(data.from)} – ${fmtDate(data.to)}</span></form><div class="cards"><div class="stat-card hero"><div class="stat-top">Doanh thu đã thu ${icon('money')}</div><div class="stat-value money">${money(data.paid_revenue)}</div><div class="stat-foot">Theo ngày ghi nhận thanh toán</div></div><div class="stat-card"><div class="stat-top">Tổng đơn đặt ${icon('list')}</div><div class="stat-value">${esc(data.booking_count)}</div><div class="stat-foot">Đơn đặt có lịch chơi trong kỳ</div></div><div class="stat-card"><div class="stat-top">Chưa thanh toán ${icon('wallet')}</div><div class="stat-value money">${money(data.unpaid_total)}</div><div class="stat-foot">Tổng tiền các đơn chưa hủy</div></div><div class="stat-card"><div class="stat-top">Đơn đã hủy ${icon('close')}</div><div class="stat-value">${esc(data.cancelled_count)}</div><div class="stat-foot">Các khung giờ đã được giải phóng</div></div></div><div class="report-grid"><section class="panel"><div class="panel-head"><h2>Doanh thu theo ngày thu tiền</h2><span class="small muted">VND</span></div><div class="panel-body">${daily.length ? `<div class="chart-container"><div class="chart" style="min-width:${chartWidth}px" role="img" aria-label="Biểu đồ doanh thu từng ngày. Số tiền được hiển thị trên các cột.">${daily.map(d => `<div class="chart-col" title="${fmtDate(d.date)}: ${money(d.paid_revenue)}, ${esc(d.booking_count)} đơn"><span class="chart-value">${Number(d.paid_revenue) ? shortMoney(d.paid_revenue) : '0'}</span><div class="chart-bar" style="height:${Math.max(3,Number(d.paid_revenue)/maximum*168)}px"></div><span class="chart-label">${fmtDate(d.date).slice(0,5)}</span></div>`).join('')}</div></div><p class="chart-description">Chỉ tính số tiền đã thanh toán. Đơn chưa thanh toán và đơn đã hủy không đóng góp doanh thu.</p>` : empty('Chưa có doanh thu','Thử chọn khoảng thời gian có lịch chơi.','','chart')}</div></section><section class="panel"><div class="panel-head"><h2>Phương thức thanh toán</h2></div><div class="panel-body">${(data.by_payment_method || []).length ? data.by_payment_method.map(p => `<div class="payment-method"><div class="payment-method-icon">${icon(p.method === 'CASH' ? 'money' : 'transfer')}</div><div><strong>${p.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</strong><div class="small">${esc(p.count)} giao dịch</div></div><div class="amount">${money(p.amount)}</div></div>`).join('') : empty('Chưa có thanh toán','Các giao dịch đã thu tiền sẽ xuất hiện tại đây.','','wallet')}</div></section></div><section class="panel"><div class="panel-head"><h2>Hiệu quả theo sân</h2></div>${(data.by_court || []).length ? `<div class="table-scroll"><table><thead><tr><th>Sân</th><th>Đơn đặt</th><th>Số giờ đã đặt</th><th>Doanh thu đã thu</th></tr></thead><tbody>${data.by_court.map(c => `<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.booking_count)}</td><td>${esc(c.booked_hours)} giờ</td><td class="mono">${money(c.paid_revenue)}</td></tr>`).join('')}</tbody></table></div>` : empty('Chưa có dữ liệu sân','Các sân sẽ được tổng hợp khi có dữ liệu.','','court')}</section>${footer()}`;
}

function openModal(heading,description,body,footerHtml = '',wide = false) {
  if (!modalRoot.firstElementChild) state.modalReturnFocus = document.activeElement;
  modalRoot.innerHTML = `<div class="modal-overlay"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><div><h2 id="modal-title">${esc(heading)}</h2><p>${esc(description)}</p></div><button class="close-button" data-action="close-modal" aria-label="Đóng hộp thoại">${icon('close')}</button></header><div class="modal-body">${body}</div>${footerHtml ? `<footer class="modal-footer">${footerHtml}</footer>` : ''}</section></div>`;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => modalRoot.querySelector('input:not([type=hidden]),select,textarea,button')?.focus());
}
function closeModal() {
  modalRoot.innerHTML = ''; document.body.style.overflow = ''; state.modal = null;
  clearTimeout(customerSearchTimer);
  state.modalReturnFocus?.focus?.(); state.modalReturnFocus = null;
}
function modalError(error) { const target = document.getElementById('modal-error'); if (target) { target.textContent = error.message || String(error); target.scrollIntoView({block:'nearest'}); } else toast(error.message || String(error),true); }
function customerForm(customer = null) {
  state.modal = {type:'customer',customer};
  openModal(customer ? 'Sửa thông tin khách hàng' : 'Thêm khách hàng','Lưu thông tin để liên hệ và tra cứu lịch sử đặt sân.',`<form id="customer-form"><div class="form-error" id="modal-error" role="alert"></div><div class="field"><label for="full-name">Họ và tên <span class="muted">*</span></label><input id="full-name" name="full_name" value="${esc(customer?.full_name)}" maxlength="100" autocomplete="name" required></div><div class="form-grid"><div class="field"><label for="phone">Số điện thoại <span class="muted">*</span></label><input id="phone" name="phone" value="${esc(customer?.phone)}" maxlength="20" inputmode="tel" autocomplete="tel" pattern="(0[0-9]{9,10}|[+]84[0-9]{9,10})" required><div class="field-hint">VD: 0912345678 hoặc +84912345678. Mỗi số tương ứng một khách hàng.</div></div><div class="field"><label for="email">Email</label><input id="email" name="email" type="email" value="${esc(customer?.email)}" maxlength="150" autocomplete="email" placeholder="Không bắt buộc"></div></div></form>`,`${button('Đóng','close-modal','','secondary')}<button class="btn" type="submit" form="customer-form">${icon('check')}Lưu khách hàng</button>`);
}
function courtForm(court = null) {
  state.modal = {type:'court',court};
  openModal(court ? 'Cập nhật sân' : 'Thêm sân mới','Thông tin, giá thuê và tình trạng hoạt động của sân.',`<form id="court-form"><div class="form-error" id="modal-error" role="alert"></div><div class="form-grid"><div class="field"><label for="court-code">Mã sân <span class="muted">*</span></label><input id="court-code" name="code" value="${esc(court?.code)}" placeholder="VD: SAN-05" maxlength="20" pattern="[A-Za-z0-9_-]+" required></div><div class="field"><label for="court-name">Tên sân <span class="muted">*</span></label><input id="court-name" name="name" value="${esc(court?.name)}" placeholder="VD: Sân 05" maxlength="100" required></div><div class="field"><label for="hourly-price">Giá thuê / giờ (VND) <span class="muted">*</span></label><input id="hourly-price" name="hourly_price" value="${esc(court?.hourly_price ?? 150000)}" type="number" min="1000" max="10000000" step="1000" required></div><div class="field"><label for="court-status">Trạng thái</label><select id="court-status" name="status">${[['ACTIVE','Đang hoạt động'],['MAINTENANCE','Bảo trì'],['INACTIVE','Ngừng hoạt động']].map(([v,l]) => `<option value="${v}" ${(court?.status || 'ACTIVE') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="field full"><label for="court-description">Mô tả</label><textarea id="court-description" name="description" maxlength="500" placeholder="VD: Sân ngoài trời, có đèn chiếu sáng">${esc(court?.description)}</textarea></div></div><div class="field-hint">Giá mới chỉ áp dụng cho đơn đặt mới. Nếu sân còn lịch đặt chưa kết thúc, cần xử lý các đơn đó trước khi bảo trì hoặc ngừng hoạt động.</div></form>`,`${button('Đóng','close-modal','','secondary')}<button class="btn" type="submit" form="court-form">${icon('check')}Lưu sân</button>`);
}
async function showBookingDetail(id) {
  const booking = await api(`/api/bookings/${id}`);
  state.modal = {type:'booking-detail',booking};
  const paid = booking.payment_status === 'PAID';
  const active = booking.status === 'CONFIRMED';
  const actions = `${active && !paid ? button('Hủy đơn','cancel-booking','close','danger',`data-id="${esc(id)}"`) : ''}${active && !paid ? button('Ghi nhận thanh toán','pay-booking','money','',`data-id="${esc(id)}"`) : ''}${active && paid ? button('Hoàn thành','complete-booking','check','',`data-id="${esc(id)}"`) : ''}${!active ? button('Đóng','close-modal','','secondary') : ''}`;
  const payment = booking.payment;
  openModal(booking.booking_code,`Tạo lúc ${fmtDateTime(booking.created_at)}`,`<div class="form-error" id="modal-error" role="alert"></div><dl class="detail-summary"><div><dt>Khách hàng</dt><dd>${esc(booking.customer_name)}<br><span class="muted">${esc(booking.customer_phone)}</span></dd></div><div><dt>Trạng thái đơn</dt><dd>${bookingBadge(booking.status)}</dd></div><div><dt>Sân & ngày chơi</dt><dd>${esc(booking.court_name)} · ${fmtDate(booking.play_date)}</dd></div><div><dt>Thanh toán</dt><dd>${paymentBadge(booking.payment_status)}${payment ? `<div class="small muted" style="margin-top:8px">${payment.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'} · ${fmtDateTime(payment.paid_at)}</div>` : ''}</dd></div></dl><div class="table-scroll"><table><thead><tr><th>Khung giờ</th><th>Giá thuê</th><th>Giữ chỗ</th></tr></thead><tbody>${(booking.items || []).map(item => `<tr><td>${time(item.start_time)}–${time(item.end_time)}</td><td>${money(item.unit_price)}</td><td><span class="badge ${item.released_at ? 'grey' : 'green'}">${item.released_at ? 'Đã giải phóng' : 'Đã giữ chỗ'}</span></td></tr>`).join('')}</tbody></table></div>${booking.note ? `<div class="detail-note"><strong>Ghi chú:</strong> ${esc(booking.note)}</div>` : ''}<div class="detail-total"><span>Tổng tiền</span><strong>${money(booking.total_amount)}</strong></div>${active && paid ? '<div class="field-hint" style="margin-top:14px">Chỉ có thể hoàn thành sau khi kết thúc toàn bộ giờ chơi. Đơn đã thanh toán không thể hủy.</div>' : ''}${active && !paid ? '<div class="field-hint" style="margin-top:14px">Thanh toán toàn bộ đơn một lần. Hủy đơn sẽ giải phóng các khung giờ đã giữ.</div>' : ''}`,actions,true);
}
async function showCustomerHistory(id) {
  const customer = state.data.find(c => Number(c.id) === Number(id));
  const bookings = await api(`/api/customers/${id}/bookings`);
  state.modal = {type:'customer-history'};
  openModal(`Lịch sử · ${customer.full_name}`,`${customer.phone} · ${bookings.length} đơn đặt sân`,bookingTable(bookings),button('Đóng','close-modal','','secondary'),true);
}
function confirmAction(heading,description,label,action,id) {
  state.modal = {type:'confirm',action,id};
  openModal(heading,description,`<div class="form-error" id="modal-error" role="alert"></div><p class="small muted" style="font-size:13px;line-height:1.8;margin-bottom:0">${action === 'cancel' ? 'Các khung giờ của đơn sẽ được giải phóng để người khác đặt. Bạn có thể tạo đơn mới nếu khách đổi ý.' : 'Đơn sẽ được đánh dấu hoàn thành sau khi khách đã thanh toán và kết thúc giờ chơi.'}</p>`,`${button('Quay lại','return-detail','','secondary',`data-id="${esc(id)}"`)}${button(label,'confirm-booking-action',action === 'cancel' ? 'close' : 'check',action === 'cancel' ? 'danger' : '')}`);
}
function paymentForm(id) {
  const booking = state.modal?.booking;
  if (!booking || Number(booking.id) !== Number(id)) return;
  state.modal = {type:'payment',booking};
  openModal('Ghi nhận thanh toán',`${booking.booking_code} · ${booking.customer_name}`,`<form id="payment-form"><div class="form-error" id="modal-error" role="alert"></div><div class="detail-total" style="margin:0 0 24px"><span>Thu toàn bộ đơn</span><strong>${money(booking.total_amount)}</strong></div><div class="field"><label for="payment-method">Phương thức thanh toán</label><select id="payment-method" name="method"><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select></div><div class="field-hint">Chỉ xác nhận sau khi đã nhận đủ tiền từ khách. Chức năng này ghi nhận thanh toán, không thực hiện chuyển tiền.</div></form>`,`${button('Quay lại','return-detail','','secondary',`data-id="${esc(id)}"`)}<button class="btn" type="submit" form="payment-form">${icon('check')}Đã nhận đủ tiền</button>`);
}
async function checkout() {
  const {court,slots,total} = selectedInfo();
  if (!court || !slots.length) { toast('Chọn ít nhất một khung giờ trống.',true); return; }
  for (let i=1;i<slots.length;i++) if (time(slots[i-1].end_time) !== time(slots[i].start_time)) { toast('Các khung giờ phải liên tiếp nhau trên cùng một sân.',true); return; }
  state.selectedCustomer = null;
  state.modal = {type:'checkout',court,slots,total,date:state.bookingDate,customerSearchRequest:0};
  openModal('Xác nhận đặt sân','Chọn khách hàng và kiểm tra lịch trước khi giữ chỗ.',`<form id="checkout-form"><div class="form-error" id="modal-error" role="alert"></div><div class="booking-checkout"><div><strong>${esc(court.name)}</strong><div class="small">${fmtDate(state.bookingDate)} · ${time(slots[0].start_time)}–${time(slots[slots.length-1].end_time)}<br>${slots.length} giờ × ${money(court.hourly_price)}</div></div><strong class="checkout-price">${money(total)}</strong></div><div class="field"><div class="customer-picker-head"><label for="checkout-search">Khách hàng <span class="muted">*</span></label><button type="button" class="btn secondary sm" data-action="toggle-inline-customer">${icon('plus')}Thêm mới</button></div><div class="search-box">${icon('search')}<input id="checkout-search" placeholder="Tìm theo tên hoặc số điện thoại…" autocomplete="off" maxlength="100"></div><div id="checkout-customers" class="customer-results"><div class="small muted" style="padding:15px">Đang tải khách hàng…</div></div><div class="field-hint" id="selected-customer-label">Chưa chọn khách hàng.</div><div id="inline-customer" class="inline-new-customer" hidden><div class="form-grid"><div class="field"><label for="inline-name">Họ tên</label><input id="inline-name" maxlength="100" autocomplete="name"></div><div class="field"><label for="inline-phone">Số điện thoại</label><input id="inline-phone" maxlength="20" inputmode="tel" autocomplete="tel"></div></div><div class="field"><label for="inline-email">Email (không bắt buộc)</label><input id="inline-email" type="email" maxlength="150" autocomplete="email"></div><button type="button" class="btn secondary sm" data-action="save-inline-customer">Lưu và chọn khách hàng</button></div></div><div class="field"><label for="booking-note">Ghi chú</label><textarea id="booking-note" name="note" maxlength="500" placeholder="VD: Khách cần thuê thêm vợt…"></textarea></div><div class="field-hint">Hệ thống sẽ kiểm tra lại tình trạng sân khi xác nhận. Đơn mới chưa được thanh toán.</div></form>`,`${button('Quay lại','close-modal','','secondary')}<button class="btn" type="submit" form="checkout-form">${icon('check')}Xác nhận đặt sân</button>`);
  await searchCheckoutCustomers('');
}
async function searchCheckoutCustomers(query) {
  if (state.modal?.type !== 'checkout') return;
  const modal = state.modal;
  const request = ++modal.customerSearchRequest;
  const container = document.getElementById('checkout-customers');
  if (!container) return;
  container.innerHTML = '<div class="small muted" style="padding:15px">Đang tìm khách hàng…</div>';
  try {
    const customers = await api(`/api/customers?q=${encodeURIComponent(query)}`);
    if (state.modal !== modal || modal.customerSearchRequest !== request) return;
    modal.customers = customers;
    container.innerHTML = customers.length ? customers.map(c => `<button class="customer-result ${Number(state.selectedCustomer?.id) === Number(c.id) ? 'selected' : ''}" type="button" data-action="select-customer" data-id="${esc(c.id)}"><div class="avatar">${esc(c.full_name.charAt(0))}</div><div><strong>${esc(c.full_name)}</strong><small>${esc(c.phone)}</small></div>${Number(state.selectedCustomer?.id) === Number(c.id) ? icon('check') : ''}</button>`).join('') : '<div class="small muted" style="padding:15px">Không tìm thấy khách hàng. Chọn “Thêm mới” để tạo.</div>';
  } catch (error) { if (state.modal === modal) container.innerHTML = `<div class="small" style="padding:15px;color:var(--red)">${esc(error.message)}</div>`; }
}
function pickCustomer(customer) {
  state.selectedCustomer = customer;
  const label = document.getElementById('selected-customer-label');
  if (label) { label.textContent = `Đã chọn: ${customer.full_name} · ${customer.phone}`; label.style.color = '#527237'; }
  document.querySelectorAll('.customer-result').forEach(b => b.classList.toggle('selected',Number(b.dataset.id) === Number(customer.id)));
}

document.addEventListener('click', async event => {
  const element = event.target.closest('[data-action]'); if (!element || element.disabled) return;
  const action = element.dataset.action;
  if (element.tagName === 'BUTTON') event.preventDefault();
  try {
    switch(action) {
      case 'menu': document.querySelector('.sidebar')?.classList.add('open'); document.querySelector('.mobile-overlay')?.classList.add('open'); break;
      case 'close-nav': closeMobileNav(); break;
      case 'reload': await loadPage(); break;
      case 'go-booking': navigate('booking'); break;
      case 'go-courts': navigate('courts'); break;
      case 'close-modal': closeModal(); break;
      case 'logout': {
        await api('/api/auth/logout',{method:'POST',body:{}}); const session = await api('/api/auth/session');
        state.user = null; state.csrf = session.csrf_token; state.config = null; state.selectedSlots = []; state.selectedCourt = null;
        closeModal(); renderLogin(); break;
      }
      case 'new-customer': customerForm(); break;
      case 'edit-customer': customerForm(state.data.find(c => Number(c.id) === Number(element.dataset.id))); break;
      case 'customer-history': await showCustomerHistory(Number(element.dataset.id)); break;
      case 'new-court': courtForm(); break;
      case 'edit-court': courtForm(state.data.find(c => Number(c.id) === Number(element.dataset.id))); break;
      case 'booking-detail': await showBookingDetail(Number(element.dataset.id)); break;
      case 'return-detail': await showBookingDetail(Number(element.dataset.id)); break;
      case 'pay-booking': paymentForm(Number(element.dataset.id)); break;
      case 'cancel-booking': confirmAction('Hủy đơn đặt sân?','Chỉ đơn chưa thanh toán mới có thể hủy.','Xác nhận hủy đơn','cancel',Number(element.dataset.id)); break;
      case 'complete-booking': confirmAction('Hoàn thành đơn đặt sân?','Xác nhận khách đã kết thúc toàn bộ giờ chơi.','Xác nhận hoàn thành','complete',Number(element.dataset.id)); break;
      case 'confirm-booking-action': {
        const {id,action:operation} = state.modal;
        element.disabled = true;
        try { await api(`/api/bookings/${id}/${operation}`,{method:'POST',body:{}}); toast(operation === 'cancel' ? 'Đã hủy đơn và giải phóng khung giờ.' : 'Đã hoàn thành đơn đặt sân.'); closeModal(); await loadPage(); }
        catch (error) { modalError(error); element.disabled = false; }
        break;
      }
      case 'clear-booking-filter': state.bookingFilters = {date:'',status:'',q:''}; await loadPage(); break;
      case 'select-slot': {
        const court = Number(element.dataset.court), slot = Number(element.dataset.slot);
        if (state.selectedCourt !== court) { state.selectedCourt = court; state.selectedSlots = []; }
        state.selectedSlots = state.selectedSlots.includes(slot) ? state.selectedSlots.filter(s => s !== slot) : [...state.selectedSlots,slot];
        // Keep the timeline and its horizontal scroll position intact while selection changes.
        document.querySelectorAll('.slot[data-action="select-slot"]').forEach(el => {
          const selected = Number(el.dataset.court) === state.selectedCourt && state.selectedSlots.includes(Number(el.dataset.slot));
          el.classList.toggle('selected',selected); el.setAttribute('aria-pressed',String(selected));
          if (!el.disabled) { el.innerHTML = `${icon(selected ? 'check' : 'plus')}<span>${selected ? 'Đã chọn' : 'Trống'}</span>`; el.title = selected ? 'Đang chọn' : 'Còn trống'; }
        });
        document.querySelector('.selection-panel .panel-body').innerHTML = `<div class="selection-title">LỊCH CHƠI CỦA BẠN</div>${selectionSummary()}`;
        break;
      }
      case 'clear-selection': state.selectedCourt = null; state.selectedSlots = []; setContent(renderBooking(state.data)); break;
      case 'checkout': await checkout(); break;
      case 'toggle-inline-customer': { const section = document.getElementById('inline-customer'); section.hidden = !section.hidden; if (!section.hidden) document.getElementById('inline-name').focus(); break; }
      case 'select-customer': { const customer = state.modal.customers.find(c => Number(c.id) === Number(element.dataset.id)); if (customer) pickCustomer(customer); break; }
      case 'save-inline-customer': {
        const name = document.getElementById('inline-name'), phone = document.getElementById('inline-phone'), email = document.getElementById('inline-email');
        if (!name.value.trim() || !phone.value.trim()) { modalError(new Error('Nhập họ tên và số điện thoại khách hàng.')); break; }
        if (!email.checkValidity()) { email.reportValidity(); break; }
        element.disabled = true;
        try {
          const customer = await api('/api/customers',{method:'POST',body:{full_name:name.value.trim(),phone:phone.value.trim(),email:email.value.trim() || null}});
          pickCustomer(customer); document.getElementById('inline-customer').hidden = true;
          document.getElementById('checkout-search').value = customer.phone;
          await searchCheckoutCustomers(customer.phone); document.getElementById('modal-error').textContent = ''; toast('Đã thêm và chọn khách hàng mới.');
        } catch (error) { modalError(error); } finally { element.disabled = false; }
        break;
      }
    }
  } catch (error) { toast(error.message,true); }
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const fields = Object.fromEntries(new FormData(form));
  const submit = event.submitter || document.querySelector(`[form="${form.id}"][type="submit"]`) || form.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    switch(form.id) {
      case 'login-form': {
        // Obtain a fresh anonymous-session token even if the page has been open for a long time.
        const anonymous = await api('/api/auth/session'); state.csrf = anonymous.csrf_token;
        await api('/api/auth/login',{method:'POST',body:{username:fields.username.trim(),password:fields.password}});
        const session = await api('/api/auth/session'); state.user = session.user; state.csrf = session.csrf_token;
        if (!session.authenticated) throw new Error('Đăng nhập chưa thành công. Vui lòng thử lại.');
        await startAuthenticated(); break;
      }
      case 'booking-filter': state.bookingFilters = {date:fields.date,status:fields.status,q:fields.q.trim()}; await loadPage(); break;
      case 'customer-filter': state.customerQuery = fields.q.trim(); await loadPage(); break;
      case 'report-filter': {
        if (fields.from > fields.to) { toast('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',true); break; }
        const days = (Date.parse(`${fields.to}T00:00:00Z`) - Date.parse(`${fields.from}T00:00:00Z`))/86400000 + 1;
        if (days > 93) { toast('Chọn khoảng thống kê tối đa 93 ngày.',true); break; }
        state.reportFrom = fields.from; state.reportTo = fields.to; await loadPage(); break;
      }
      case 'customer-form': {
        const id = state.modal.customer?.id;
        await api(id ? `/api/customers/${id}` : '/api/customers',{method:id ? 'PUT' : 'POST',body:{full_name:fields.full_name.trim(),phone:fields.phone.trim(),email:fields.email.trim() || null}});
        closeModal(); toast(id ? 'Đã cập nhật thông tin khách hàng.' : 'Đã thêm khách hàng.'); await loadPage(); break;
      }
      case 'court-form': {
        const id = state.modal.court?.id;
        await api(id ? `/api/courts/${id}` : '/api/courts',{method:id ? 'PUT' : 'POST',body:{code:fields.code.trim(),name:fields.name.trim(),description:fields.description.trim(),hourly_price:Number(fields.hourly_price),status:fields.status}});
        closeModal(); toast(id ? 'Đã cập nhật thông tin sân.' : 'Đã thêm sân mới.'); await loadPage(); break;
      }
      case 'payment-form': {
        const id = state.modal.booking.id;
        await api(`/api/bookings/${id}/pay`,{method:'POST',body:{method:fields.method}});
        toast('Đã ghi nhận thanh toán toàn bộ đơn.'); await loadPage(); await showBookingDetail(id); break;
      }
      case 'checkout-form': {
        if (!state.selectedCustomer) throw new Error('Chọn một khách hàng trước khi xác nhận đặt sân.');
        const modal = state.modal;
        const booking = await api('/api/bookings',{method:'POST',body:{customer_id:Number(state.selectedCustomer.id),court_id:Number(modal.court.id),play_date:modal.date,slot_ids:modal.slots.map(s => Number(s.time_slot_id)),note:fields.note.trim()}});
        state.selectedCourt = null; state.selectedSlots = []; closeModal(); toast('Đã giữ chỗ thành công. Bạn có thể ghi nhận thanh toán trong chi tiết đơn.');
        await loadPage(); await showBookingDetail(booking.id); break;
      }
    }
  } catch (error) {
    if (form.id === 'login-form') { const target = document.getElementById('login-error'); if (target) target.textContent = error.message; }
    else if (modalRoot.firstElementChild) modalError(error);
    else toast(error.message,true);
  } finally { if (submit) submit.disabled = false; }
});
document.addEventListener('change', async event => {
  if (event.target.id === 'booking-date') {
    const date = event.target.value;
    if (!date || date < state.config.today || date > state.config.max_booking_date) { toast('Ngày chơi phải nằm trong khoảng cho phép.',true); event.target.value = state.bookingDate; return; }
    state.bookingDate = date; state.selectedSlots = []; state.selectedCourt = null; await loadPage();
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'checkout-search') {
    const value = event.target.value.trim(); clearTimeout(customerSearchTimer);
    customerSearchTimer = setTimeout(() => searchCheckoutCustomers(value),300);
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeModal(); closeMobileNav(); }
  if (event.key === 'Tab' && modalRoot.firstElementChild) {
    const all = [...modalRoot.querySelectorAll('button:not(:disabled),input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(el => el.offsetParent !== null);
    const first = all[0], last = all[all.length-1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
window.addEventListener('hashchange',() => { closeModal(); if (state.user) loadPage(); });
async function boot() {
  try {
    const session = await api('/api/auth/session'); state.csrf = session.csrf_token;
    if (session.authenticated) { state.user = session.user; await startAuthenticated(); }
    else renderLogin();
  } catch (error) {
    app.innerHTML = `<div class="boot-screen"><div class="error-state"><h2>Chưa thể mở Courtly</h2><p>${esc(error.message)}</p>${button('Kết nối lại','retry-boot','refresh','secondary')}</div></div>`;
  }
}
document.addEventListener('click',event => { if (event.target.closest('[data-action="retry-boot"]')) boot(); });
boot();
